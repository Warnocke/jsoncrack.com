import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Group, Textarea } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const setGraph = useGraph(state => state.setGraph);
  const setSelectedNode = useGraph(state => state.setSelectedNode);
  const jsonState = useJson(state => state.json);
  const setJson = useJson(state => state.setJson);
  const setContents = useFile(state => state.setContents);

  const [editing, setEditing] = React.useState(false);
  const [edited, setEdited] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // reset when node changes or modal closed
    setEditing(false);
    setEdited("");
    setError(null);
  }, [nodeData, opened]);

  const handleEdit = () => {
    setEdited(normalizeNodeData(nodeData?.text ?? []));
    setEditing(true);
    setError(null);
  };

  const applyEditToJson = (raw: string) => {
    if (!nodeData) return;

    // parse current json into object
    let currentObj: any;
    try {
      currentObj = JSON.parse(jsonState);
    } catch (e) {
      setError("Failed to parse current JSON document.");
      return;
    }

    const isLeaf = nodeData.text.length === 1 && !nodeData.text[0].key;
    let newValue: any = undefined;

    if (isLeaf) {
      const leafType = nodeData.text[0].type;
      // coerce based on original type
      if (leafType === "string") {
        newValue = raw;
      } else if (leafType === "number") {
        const n = Number(raw);
        if (Number.isNaN(n)) {
          setError("Invalid number");
          return;
        }
        newValue = n;
      } else if (leafType === "boolean") {
        const v = raw.trim().toLowerCase();
        if (v !== "true" && v !== "false") {
          setError("Invalid boolean (must be true or false)");
          return;
        }
        newValue = v === "true";
      } else if (leafType === "null") {
        newValue = null;
      } else {
        // fallback: try JSON.parse, or use raw
        try {
          newValue = JSON.parse(raw);
        } catch (e) {
          newValue = raw;
        }
      }
    } else {
      // expect an object representation
      try {
        // allow editing a fragment like `{"a":1}`
        newValue = JSON.parse(raw);
      } catch (e) {
        setError("Invalid JSON for object/array node");
        return;
      }
    }

    // apply newValue at nodeData.path
    const path = nodeData.path ?? [];
    if (path.length === 0) {
      // replace root
      currentObj = newValue;
    } else {
      let ptr: any = currentObj;
      for (let i = 0; i < path.length - 1; i++) {
        const seg = path[i] as any;
        if (typeof ptr[seg] === "undefined") ptr[seg] = {};
        ptr = ptr[seg];
      }

      const last = path[path.length - 1] as any;
      ptr[last] = newValue;
    }

    const newJsonStr = JSON.stringify(currentObj, null, 2);

    // update editor and graph
    try {
      setJson(newJsonStr);
      setContents({ contents: newJsonStr, hasChanges: true });
      // ensure graph parsed immediately
      setGraph(newJsonStr);
      // clear selection to avoid stale objects
      setSelectedNode(null as any);
    } catch (e) {
      setError("Failed to apply changes");
      return;
    }

    setEditing(false);
    setEdited("");
    setError(null);
  };

  const handleSave = () => {
    applyEditToJson(edited);
  };

  const handleCancel = () => {
    setEditing(false);
    setEdited("");
    setError(null);
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Flex gap="xs" align="center">
              {!editing && (
                <Button size="xs" variant="outline" onClick={handleEdit}>
                  Edit
                </Button>
              )}
              {editing && (
                <Flex gap={6}>
                  <Button size="xs" onClick={handleSave}>
                    Save
                  </Button>
                  <Button size="xs" variant="subtle" onClick={handleCancel}>
                    Cancel
                  </Button>
                </Flex>
              )}
              <CloseButton onClick={onClose} />
            </Flex>
          </Flex>
          <ScrollArea.Autosize mah={250} maw={600}>
            {!editing ? (
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            ) : (
              <Textarea minRows={6} value={edited} onChange={e => setEdited(e.currentTarget.value)} />
            )}
          </ScrollArea.Autosize>
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
        {error && (
          <Text color="red" fz="xs">
            {error}
          </Text>
        )}
      </Stack>
    </Modal>
  );
};
