import { Clipboard } from "@wailsio/runtime";
import { ref } from "vue";

import { showInputModal } from "@/composables/useInputModal";
import { normalizeModelAdapter, validateModelAdapters } from "@/state/appState";
import {
  createTransferableModelAdapter,
  decryptModelAdapter,
  encryptModelAdapter,
  inspectEncryptedModelAdapter,
  ModelClipboardCryptoError,
} from "@/utils/modelClipboardCrypto";

const MIN_PASSPHRASE_LENGTH = 8;

function validatePassphrase(passphrase, confirmation = null) {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return `口令至少需要 ${MIN_PASSPHRASE_LENGTH} 个字符`;
  }
  if (confirmation !== null && passphrase !== confirmation) {
    return "两次输入的口令不一致";
  }
  return "";
}

function userMessage(error, operation) {
  if (error instanceof ModelClipboardCryptoError) {
    return error.message;
  }
  if (operation === "read") {
    return "无法读取系统剪贴板，请检查应用权限后重试";
  }
  if (operation === "write") {
    return "无法写入系统剪贴板，请检查应用权限后重试";
  }
  return "加密模型配置处理失败";
}

async function requestExportPassphrase() {
  return showInputModal({
    title: "设置导出口令",
    content: "该口令不会保存。导入时必须输入相同口令，建议使用至少 8 个字符。",
    placeholder: "输入加密口令",
    confirmPlaceholder: "再次输入加密口令",
    type: "password",
    confirmInput: true,
    validate: (value, confirmation) => validatePassphrase(value, confirmation),
  });
}

async function requestImportPassphrase() {
  return showInputModal({
    title: "输入导入口令",
    content: "请输入导出该模型配置时使用的口令。",
    placeholder: "输入解密口令",
    type: "password",
    validate: (value) => validatePassphrase(value),
  });
}

/**
 * 单模型安全传输边界：剪贴板只接触认证密文，解密结果仅作为未保存草稿返回。
 */
export function useModelClipboardTransfer({ message } = {}) {
  const modelClipboardBusy = ref(false);

  async function exportModelToClipboard(adapter) {
    if (modelClipboardBusy.value) {
      return false;
    }
    const normalized = normalizeModelAdapter(adapter);
    const validationError = validateModelAdapters([normalized]);
    if (validationError) {
      message?.(`导出失败：${validationError}`);
      return false;
    }

    const passphrase = await requestExportPassphrase();
    if (passphrase === null) {
      return false;
    }

    modelClipboardBusy.value = true;
    try {
      const encrypted = await encryptModelAdapter(createTransferableModelAdapter(normalized), passphrase);
      await Clipboard.SetText(encrypted);
      message?.("模型配置已加密复制到剪贴板");
      return true;
    } catch (error) {
      message?.(`导出失败：${userMessage(error, "write")}`);
      return false;
    } finally {
      modelClipboardBusy.value = false;
    }
  }

  async function importModelFromClipboard() {
    if (modelClipboardBusy.value) {
      return null;
    }

    let serialized;
    try {
      serialized = await Clipboard.Text();
      inspectEncryptedModelAdapter(serialized);
    } catch (error) {
      message?.(`导入失败：${userMessage(error, "read")}`);
      return null;
    }

    const passphrase = await requestImportPassphrase();
    if (passphrase === null) {
      return null;
    }

    modelClipboardBusy.value = true;
    try {
      const imported = normalizeModelAdapter(await decryptModelAdapter(serialized, passphrase));
      const validationError = validateModelAdapters([imported]);
      if (validationError) {
        throw new ModelClipboardCryptoError("PAYLOAD", validationError);
      }
      message?.("模型配置已导入当前草稿，请检查后点击保存");
      return imported;
    } catch (error) {
      message?.(`导入失败：${userMessage(error, "decrypt")}`);
      return null;
    } finally {
      modelClipboardBusy.value = false;
    }
  }

  return {
    modelClipboardBusy,
    exportModelToClipboard,
    importModelFromClipboard,
  };
}