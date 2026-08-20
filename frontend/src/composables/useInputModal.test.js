import assert from "node:assert/strict";
import test from "node:test";

import {
  inputModalState,
  resolveInputModal,
  showInputModal,
} from "./useInputModal.js";

test("password confirmation blocks mismatch and clears values after success", async () => {
  const result = showInputModal({
    type: "password",
    confirmInput: true,
    validate: (value, confirmation) => (value === confirmation ? "" : "口令不一致"),
  });
  inputModalState.value = "secret passphrase";
  inputModalState.confirmValue = "different";

  assert.equal(resolveInputModal(true), false);
  assert.equal(inputModalState.visible, true);
  assert.equal(inputModalState.error, "口令不一致");

  inputModalState.confirmValue = "secret passphrase";
  assert.equal(resolveInputModal(true), true);
  assert.equal(await result, "secret passphrase");
  assert.equal(inputModalState.visible, false);
  assert.equal(inputModalState.value, "");
  assert.equal(inputModalState.confirmValue, "");
});

test("cancelling password input resolves null and clears the secret", async () => {
  const result = showInputModal({ type: "password" });
  inputModalState.value = "temporary secret";

  assert.equal(resolveInputModal(false), true);
  assert.equal(await result, null);
  assert.equal(inputModalState.value, "");
});