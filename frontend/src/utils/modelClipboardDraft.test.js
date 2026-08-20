import assert from "node:assert/strict";
import test from "node:test";

import { mergeImportedModelDraft } from "./modelClipboardDraft.js";

test("editing import preserves the target identity and replaces imported runtime identity", () => {
  const merged = mergeImportedModelDraft(
    { id: "existing-id", sort: 4, displayName: "old" },
    { id: "foreign-id", sort: 99, displayName: "imported", apiKey: "secret" },
  );

  assert.deepEqual(merged, {
    id: "existing-id",
    sort: 4,
    displayName: "imported",
    apiKey: "secret",
  });
});

test("new model import remains an unsaved model without runtime identity", () => {
  const merged = mergeImportedModelDraft(
    { id: "", sort: 0 },
    { displayName: "imported", modelID: "model" },
  );

  assert.equal(merged.id, "");
  assert.equal(merged.sort, 0);
  assert.equal(merged.displayName, "imported");
});