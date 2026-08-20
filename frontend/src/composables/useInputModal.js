import { reactive } from "vue";

export const inputModalState = reactive({
  visible: false,
  title: "提示",
  content: "",
  placeholder: "",
  confirmPlaceholder: "",
  inputType: "text",
  confirmInput: false,
  value: "",
  confirmValue: "",
  error: "",
  _validate: null,
  _resolve: null,
});

/**
 * 显示输入弹窗，返回 Promise<string|null>。
 * validate 可返回错误文本阻止弹窗关闭；password 类型不会自动裁剪首尾空白。
 */
export function showInputModal(options = {}) {
  if (inputModalState._resolve) {
    inputModalState._resolve(null);
  }
  return new Promise((resolve) => {
    inputModalState.visible = true;
    inputModalState.title = options.title ?? "提示";
    inputModalState.content = options.content ?? "";
    inputModalState.placeholder = options.placeholder ?? "";
    inputModalState.confirmPlaceholder = options.confirmPlaceholder ?? "再次输入口令";
    inputModalState.inputType = options.type === "password" ? "password" : "text";
    inputModalState.confirmInput = Boolean(options.confirmInput);
    inputModalState.value = String(options.defaultValue ?? "");
    inputModalState.confirmValue = "";
    inputModalState.error = "";
    inputModalState._validate = typeof options.validate === "function" ? options.validate : null;
    inputModalState._resolve = resolve;
  });
}

export function resolveInputModal(ok) {
  const rawValue = String(inputModalState.value ?? "");
  const value = inputModalState.inputType === "password" ? rawValue : rawValue.trim();
  if (ok) {
    const validationError = inputModalState._validate?.(value, String(inputModalState.confirmValue ?? ""));
    if (validationError) {
      inputModalState.error = String(validationError);
      return false;
    }
  }

  const resolve = inputModalState._resolve;
  inputModalState.visible = false;
  inputModalState.value = "";
  inputModalState.confirmValue = "";
  inputModalState.error = "";
  inputModalState._validate = null;
  inputModalState._resolve = null;
  resolve?.(ok ? value : null);
  return true;
}
