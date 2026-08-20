const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder("utf-8", { fatal: true });

export const MODEL_CLIPBOARD_MAGIC = "cursor-byok:model-adapter";
export const MODEL_CLIPBOARD_VERSION = 1;
export const MODEL_CLIPBOARD_ALGORITHM = "AES-256-GCM";
export const MODEL_CLIPBOARD_KDF = "PBKDF2-SHA-256";
export const MODEL_CLIPBOARD_KDF_ITERATIONS = 310000;

const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const MAX_ENVELOPE_CHARS = 384 * 1024;
const MAX_PAYLOAD_BYTES = 192 * 1024;
const TRANSFER_MODEL_FIELDS = Object.freeze([
  "displayName",
  "type",
  "baseURL",
  "apiKey",
  "tooltipData",
  "modelID",
  "reasoningEffort",
  "openAIEndpoint",
  "openAIExtraParamsEnabled",
  "openAIExtraParamsJSON",
  "customHeadersEnabled",
  "customHeadersJSON",
  "anthropicExtraParamsEnabled",
  "anthropicExtraParamsJSON",
  "contextWindowTokens",
  "maxCompletionTokens",
  "anthropicMaxTokens",
  "anthropicThinkingEffort",
  "thinkingBudgetTokens",
]);
const TRANSFER_MODEL_FIELD_SET = new Set(TRANSFER_MODEL_FIELDS);
const STRING_FIELD_LIMITS = Object.freeze({
  displayName: 256,
  type: 16,
  baseURL: 4096,
  apiKey: 16384,
  tooltipData: 8192,
  modelID: 1024,
  reasoningEffort: 32,
  openAIEndpoint: 4096,
  openAIExtraParamsJSON: 65536,
  customHeadersJSON: 65536,
  anthropicExtraParamsJSON: 65536,
  anthropicThinkingEffort: 32,
});
const BOOLEAN_FIELDS = new Set([
  "openAIExtraParamsEnabled",
  "customHeadersEnabled",
  "anthropicExtraParamsEnabled",
]);
const INTEGER_FIELDS = new Set([
  "contextWindowTokens",
  "maxCompletionTokens",
  "anthropicMaxTokens",
  "thinkingBudgetTokens",
]);

export class ModelClipboardCryptoError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ModelClipboardCryptoError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new ModelClipboardCryptoError(code, message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, allowedKeys, code, message) {
  const keys = Object.keys(value);
  if (keys.some((key) => !allowedKeys.has(key))) {
    fail(code, message);
  }
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value, expectedLength = 0) {
  if (typeof value !== "string" || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    fail("FORMAT", "剪贴板内容不是受支持的加密模型配置");
  }
  let binary;
  try {
    binary = atob(value);
  } catch {
    fail("FORMAT", "剪贴板内容不是受支持的加密模型配置");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (expectedLength && bytes.length !== expectedLength) {
    fail("FORMAT", "剪贴板内容不是受支持的加密模型配置");
  }
  return bytes;
}

function requireCrypto() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== "function") {
    fail("UNAVAILABLE", "当前运行环境不支持安全加密");
  }
  return cryptoApi;
}

function assertPassphrase(passphrase) {
  if (typeof passphrase !== "string" || passphrase.length < 8) {
    fail("PASSPHRASE", "口令至少需要 8 个字符");
  }
}

function buildAdditionalData() {
  return TEXT_ENCODER.encode([
    MODEL_CLIPBOARD_MAGIC,
    MODEL_CLIPBOARD_VERSION,
    MODEL_CLIPBOARD_ALGORITHM,
    MODEL_CLIPBOARD_KDF,
    MODEL_CLIPBOARD_KDF_ITERATIONS,
  ].join("|"));
}

async function deriveKey(passphrase, salt, usage) {
  const cryptoApi = requireCrypto();
  const material = await cryptoApi.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return cryptoApi.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: MODEL_CLIPBOARD_KDF_ITERATIONS,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

function validateTransferModel(model) {
  if (!isPlainObject(model)) {
    fail("PAYLOAD", "密文中的模型配置无效");
  }
  assertExactKeys(model, TRANSFER_MODEL_FIELD_SET, "PAYLOAD", "密文中的模型配置无效");

  for (const field of TRANSFER_MODEL_FIELDS) {
    if (!Object.hasOwn(model, field)) {
      fail("PAYLOAD", "密文中的模型配置字段不完整");
    }
    const value = model[field];
    if (Object.hasOwn(STRING_FIELD_LIMITS, field)) {
      if (typeof value !== "string" || value.length > STRING_FIELD_LIMITS[field]) {
        fail("PAYLOAD", "密文中的模型配置字段非法或过长");
      }
      continue;
    }
    if (BOOLEAN_FIELDS.has(field)) {
      if (typeof value !== "boolean") {
        fail("PAYLOAD", "密文中的模型配置字段非法");
      }
      continue;
    }
    if (INTEGER_FIELDS.has(field) && (!Number.isSafeInteger(value) || value < 0)) {
      fail("PAYLOAD", "密文中的模型配置字段非法");
    }
  }
  return model;
}

export function createTransferableModelAdapter(adapter) {
  if (!isPlainObject(adapter)) {
    fail("PAYLOAD", "模型配置无效，无法导出");
  }
  const transferable = Object.fromEntries(
    TRANSFER_MODEL_FIELDS.map((field) => [field, adapter[field]]),
  );
  return validateTransferModel(transferable);
}

function parseEnvelope(serialized) {
  if (typeof serialized !== "string" || !serialized.trim()) {
    fail("EMPTY", "剪贴板为空");
  }
  if (serialized.length > MAX_ENVELOPE_CHARS) {
    fail("FORMAT", "剪贴板中的加密模型配置过大");
  }

  let envelope;
  try {
    envelope = JSON.parse(serialized);
  } catch {
    fail("FORMAT", "剪贴板内容不是受支持的加密模型配置");
  }
  if (!isPlainObject(envelope)) {
    fail("FORMAT", "剪贴板内容不是受支持的加密模型配置");
  }
  assertExactKeys(
    envelope,
    new Set(["magic", "version", "algorithm", "kdf", "salt", "nonce", "ciphertext"]),
    "FORMAT",
    "剪贴板内容不是受支持的加密模型配置",
  );
  if (envelope.magic !== MODEL_CLIPBOARD_MAGIC) {
    fail("FORMAT", "剪贴板内容不是受支持的加密模型配置");
  }
  if (envelope.version !== MODEL_CLIPBOARD_VERSION) {
    fail("VERSION", "该加密模型配置版本暂不受支持");
  }
  if (envelope.algorithm !== MODEL_CLIPBOARD_ALGORITHM) {
    fail("ALGORITHM", "该加密模型配置使用了不受支持的加密算法");
  }
  if (
    !isPlainObject(envelope.kdf)
    || envelope.kdf.name !== MODEL_CLIPBOARD_KDF
    || envelope.kdf.iterations !== MODEL_CLIPBOARD_KDF_ITERATIONS
    || Object.keys(envelope.kdf).length !== 2
  ) {
    fail("KDF", "该加密模型配置使用了不受支持的密钥派生参数");
  }
  return envelope;
}

export function inspectEncryptedModelAdapter(serialized) {
  parseEnvelope(serialized);
  return true;
}

export async function encryptModelAdapter(adapter, passphrase) {
  assertPassphrase(passphrase);
  const cryptoApi = requireCrypto();
  const model = createTransferableModelAdapter(adapter);
  const plaintext = TEXT_ENCODER.encode(JSON.stringify({ payloadVersion: 1, model }));
  if (plaintext.length > MAX_PAYLOAD_BYTES) {
    fail("PAYLOAD", "模型配置过大，无法导出");
  }

  // lyh用cursor修改 2026-08-19：每次导出都生成独立 salt/nonce，且协议元数据参与 GCM 认证。
  const salt = cryptoApi.getRandomValues(new Uint8Array(SALT_BYTES));
  const nonce = cryptoApi.getRandomValues(new Uint8Array(NONCE_BYTES));
  const key = await deriveKey(passphrase, salt, "encrypt");
  const encrypted = await cryptoApi.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: buildAdditionalData(), tagLength: 128 },
    key,
    plaintext,
  );
  return JSON.stringify({
    magic: MODEL_CLIPBOARD_MAGIC,
    version: MODEL_CLIPBOARD_VERSION,
    algorithm: MODEL_CLIPBOARD_ALGORITHM,
    kdf: { name: MODEL_CLIPBOARD_KDF, iterations: MODEL_CLIPBOARD_KDF_ITERATIONS },
    salt: bytesToBase64(salt),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  });
}

export async function decryptModelAdapter(serialized, passphrase) {
  assertPassphrase(passphrase);
  const envelope = parseEnvelope(serialized);
  const salt = base64ToBytes(envelope.salt, SALT_BYTES);
  const nonce = base64ToBytes(envelope.nonce, NONCE_BYTES);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  if (ciphertext.length < 17 || ciphertext.length > MAX_PAYLOAD_BYTES + 16) {
    fail("FORMAT", "剪贴板内容不是受支持的加密模型配置");
  }

  let plaintext;
  try {
    const key = await deriveKey(passphrase, salt, "decrypt");
    plaintext = await requireCrypto().subtle.decrypt(
      { name: "AES-GCM", iv: nonce, additionalData: buildAdditionalData(), tagLength: 128 },
      key,
      ciphertext,
    );
  } catch {
    fail("AUTH", "口令错误或密文已损坏");
  }

  let payload;
  try {
    payload = JSON.parse(TEXT_DECODER.decode(plaintext));
  } catch {
    fail("PAYLOAD", "密文中的模型配置无效");
  }
  if (!isPlainObject(payload) || payload.payloadVersion !== 1 || !Object.hasOwn(payload, "model")) {
    fail("PAYLOAD", "密文中的模型配置无效");
  }
  assertExactKeys(payload, new Set(["payloadVersion", "model"]), "PAYLOAD", "密文中的模型配置无效");
  return validateTransferModel(payload.model);
}