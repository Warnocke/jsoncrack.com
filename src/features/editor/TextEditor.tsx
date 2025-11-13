import React, { useCallback } from "react";
import { LoadingOverlay, Button, Group, Text } from "@mantine/core";
import styled from "styled-components";
import Editor, { type EditorProps, loader, type OnMount, useMonaco } from "@monaco-editor/react";
import useConfig from "../../store/useConfig";
import useFile from "../../store/useFile";
import useJson from "../../store/useJson";
import { contentToJson } from "../../lib/utils/jsonAdapter";
import { toast } from "react-hot-toast";

loader.config({
  paths: {
    vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs",
  },
});

const editorOptions: EditorProps["options"] = {
  formatOnPaste: true,
  tabSize: 2,
  formatOnType: true,
  minimap: { enabled: false },
  stickyScroll: { enabled: false },
  scrollBeyondLastLine: false,
  placeholder: "Start typing...",
};

const TextEditor = () => {
  const monaco = useMonaco();
  const contents = useFile(state => state.contents);
  const setContents = useFile(state => state.setContents);
  const setError = useFile(state => state.setError);
  const jsonSchema = useFile(state => state.jsonSchema);
  const getHasChanges = useFile(state => state.getHasChanges);
  const theme = useConfig(state => (state.darkmodeEnabled ? "vs-dark" : "light"));
  const fileType = useFile(state => state.format);

  React.useEffect(() => {
    monaco?.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      enableSchemaRequest: true,
      ...(jsonSchema && {
        schemas: [
          {
            uri: "http://myserver/foo-schema.json",
            fileMatch: ["*"],
            schema: jsonSchema,
          },
        ],
      }),
    });
  }, [jsonSchema, monaco?.languages.json.jsonDefaults]);

  React.useEffect(() => {
    const beforeunload = (e: BeforeUnloadEvent) => {
      if (getHasChanges()) {
        const confirmationMessage =
          "Unsaved changes, if you leave before saving  your changes will be lost";

        (e || window.event).returnValue = confirmationMessage; //Gecko + IE
        return confirmationMessage;
      }
    };

    window.addEventListener("beforeunload", beforeunload);

    return () => {
      window.removeEventListener("beforeunload", beforeunload);
    };
  }, [getHasChanges]);

  const handleMount: OnMount = useCallback(editor => {
    editor.onDidPaste(() => {
      editor.getAction("editor.action.formatDocument")?.run();
    });
  }, []);

  return (
    <StyledEditorWrapper>
      <StyledWrapper>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px" }}>
          <div />
          <div>
            {getHasChanges() && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Text fz="xs" color="dimmed">
                  Unsaved changes
                </Text>
                <Button
                  size="xs"
                  onClick={async () => {
                    try {
                      const currentContents = contents;
                      const format = fileType;
                      const parsed = await contentToJson(currentContents, format);
                      const jsonStr = JSON.stringify(parsed, null, 2);
                      useJson.getState().setJson(jsonStr);
                      // update file store but avoid triggering live transform (skipUpdate true)
                      useFile.getState().setContents({ contents: currentContents, hasChanges: false, skipUpdate: true } as any);
                      useFile.getState().setHasChanges(false);
                      toast.success("Saved and graph updated");
                    } catch (err: any) {
                      const msg = typeof err === "string" ? err : err?.message ?? "Failed to save";
                      toast.error(msg);
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            )}
          </div>
        </div>
        <Editor
          className="sentry-mask"
          data-sentry-mask="true"
          height="100%"
          language={fileType}
          theme={theme}
          value={contents}
          options={editorOptions}
          onMount={handleMount}
          onValidate={errors => setError(errors[0]?.message || "")}
          onChange={contents => setContents({ contents, skipUpdate: true })}
          loading={<LoadingOverlay visible />}
        />
      </StyledWrapper>
    </StyledEditorWrapper>
  );
};

export default TextEditor;

const StyledEditorWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  user-select: none;
`;

const StyledWrapper = styled.div`
  display: grid;
  height: 100%;
  grid-template-columns: 100%;
  /* top row for toolbar/status, bottom row for editor */
  grid-template-rows: auto 1fr;
`;
