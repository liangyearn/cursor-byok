import assert from "node:assert/strict";
import test from "node:test";

import {
  createTransferableModelAdapter,
  decryptModelAdapter,
  encryptModelAdapter,
  inspectEncryptedModelAdapter,
  MODEL_CLIPBOARD_KDF_ITERATIONS,
  ModelClipboardCryptoError,
} from "./modelClipboardCrypto.js";

const PASSPHRASE = "correct horse battery staple";

function createAdapter(overrides = {}) {
  return {
    id: "runtime-only-id",
    sort: 9,
    displayName: "GPT Test",
    type: "openai",
    baseURL: "https://example.com/v1",
    apiKey: "sk-sensitive-value",
    tooltipData: "test adapter",
    modelID: "gpt-test",
    reasoningEffort: "high",
    openAIEndpoint: "/v1/responses",
    openAIExtraParamsEnabled: true,
    openAIExtraParamsJSON: "{\"service_tier\":\"priority\"}",
    customHeadersEnabled: true,
    customHeadersJSON: "{\"X-Test\":\"secret-header\"}",
    anthropicExtraParamsEnabled: false,
    anthropicExtraParamsJSON: "",
    contextWindowTokens: 200000,
    maxCompletionTokens: 65536,
    anthropicMaxTokens: 0,
    anthropicThinkingEffort: "",
    thinkingBudgetTokens: 0,
    ...overrides,
  };
}

function assertCryptoError(code) {
  return (error) => {
    assert.equal(error instanceof ModelClipboardCryptoError, true);
    assert.equal(error.code, code);
    return true;
  };
}

test("encrypted model adapter round-trips without runtime identity or plaintext secrets", async () => {
  const adapter = createAdapter();
  const serialized = await encryptModelAdapter(adapter, PASSPHRASE);
  const decrypted = await decryptModelAdapter(serialized, PASSPHRASE);

  assert.deepEqual(decrypted, createTransferableModelAdapter(adapter));
  assert.equal(Object.hasOwn(decrypted, "id"), false);
  assert.equal(Object.hasOwn(decrypted, "sort"), false);
  assert.equal(serialized.includes(adapter.apiKey), false);
  assert.equal(serialized.includes("secret-header"), false);
  assert.equal(inspectEncryptedModelAdapter(serialized), true);
});

test("wrong passphrase and tampered ciphertext share authenticated failure", async () => {
  const serialized = await encryptModelAdapter(createAdapter(), PASSPHRASE);
  await assert.rejects(
    decryptModelAdapter(serialized, "wrong passphrase"),
    assertCryptoError("AUTH"),
  );

  const envelope = JSON.parse(serialized);
  const replacement = envelope.ciphertext[0] === "A" ? "B" : "A";
  envelope.ciphertext = replacement + envelope.ciphertext.slice(1);
  await assert.rejects(
    decryptModelAdapter(JSON.stringify(envelope), PASSPHRASE),
    assertCryptoError("AUTH"),
  );
});

test("fresh exports use different salt, nonce, and ciphertext", async () => {
  const first = JSON.parse(await encryptModelAdapter(createAdapter(), PASSPHRASE));
  const second = JSON.parse(await encryptModelAdapter(createAdapter(), PASSPHRASE));

  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.nonce, second.nonce);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test("rejects truncated, unknown version, magic, and KDF envelopes", async () => {
  const envelope = JSON.parse(await encryptModelAdapter(createAdapter(), PASSPHRASE));

  assert.throws(() => inspectEncryptedModelAdapter("{\"magic\":"), assertCryptoError("FORMAT"));

  const unknownMagic = { ...envelope, magic: "other" };
  assert.throws(() => inspectEncryptedModelAdapter(JSON.stringify(unknownMagic)), assertCryptoError("FORMAT"));

  const unknownVersion = { ...envelope, version: 2 };
  assert.throws(() => inspectEncryptedModelAdapter(JSON.stringify(unknownVersion)), assertCryptoError("VERSION"));

  const unknownKDF = {
    ...envelope,
    kdf: { name: "PBKDF2-SHA-512", iterations: MODEL_CLIPBOARD_KDF_ITERATIONS },
  };
  assert.throws(() => inspectEncryptedModelAdapter(JSON.stringify(unknownKDF)), assertCryptoError("KDF"));
});

test("rejects empty passphrases and invalid or oversized model fields", async () => {
  await assert.rejects(encryptModelAdapter(createAdapter(), ""), assertCryptoError("PASSPHRASE"));
  assert.throws(
    () => createTransferableModelAdapter(createAdapter({ customHeadersEnabled: "yes" })),
    assertCryptoError("PAYLOAD"),
  );
  assert.throws(
    () => createTransferableModelAdapter(createAdapter({ displayName: "x".repeat(257) })),
    assertCryptoError("PAYLOAD"),
  );
});