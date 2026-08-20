export function mergeImportedModelDraft(current, imported) {
  const currentDraft = current && typeof current === "object" ? current : {};
  const importedDraft = imported && typeof imported === "object" ? imported : {};
  return {
    ...importedDraft,
    id: String(currentDraft.id || ""),
    sort: Number.isSafeInteger(currentDraft.sort) && currentDraft.sort > 0 ? currentDraft.sort : 0,
  };
}