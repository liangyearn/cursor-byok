import {
  DisconnectCursorAccount,
  GetCursorAccountStatus,
  GetState,
  LoadUserConfig,
  SaveUserConfig,
  StartCursorAccountLogin,
  StartProxy,
  StopProxy,
} from "@bindings/cursor/internal/bridge/proxyservice.js";
import { GetHomeMetricsSummary } from "@bindings/cursor/internal/bridge/metricsservice.js";
import {
  CheckForUpdates,
  GetAppVersion,
  InstallReadyUpdate,
  OpenConfigWindow,
  OpenHistoryWindow,
  OpenModelConfigWindow,
} from "@bindings/cursor/internal/bridge/windowservice.js";
import { Call } from "@wailsio/runtime";

const API_LOG_PREFIX = "[clientApi]";
const PROXY_SERVICE_NAME = "cursor/internal/bridge.ProxyService";
const STARTUP_SERVICE_NAME = "cursor/internal/bridge.StartupService";
const SENSITIVE_LOG_KEY = /(?:api.?key|authorization|custom.?headers|extra.?params|password|passphrase|secret|ciphertext|adapter.?json)/i;

function sanitizeLogValue(value, key = "", depth = 0, seen = new WeakSet()) {
  if (SENSITIVE_LOG_KEY.test(key)) {
    return "[REDACTED]";
  }
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value !== "object" || depth >= 5) {
    return `[${typeof value}]`;
  }
  if (seen.has(value)) {
    return "[CIRCULAR]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeLogValue(item, key, depth + 1, seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      sanitizeLogValue(childValue, childKey, depth + 1, seen),
    ]),
  );
}

function sanitizeLogError(error) {
  return {
    name: String(error?.name || "Error"),
    code: String(error?.code || ""),
  };
}

function logSuccess(name, payload, result) {
  // lyh用cursor修改 2026-08-19：调用日志只记录脱敏副本，不让模型凭据和请求覆盖项进入控制台。
  console.log(`${API_LOG_PREFIX} ${name} response`, {
    payload: sanitizeLogValue(payload),
    result: sanitizeLogValue(result),
  });
}

function logError(name, payload, error) {
  console.error(`${API_LOG_PREFIX} ${name} error`, {
    payload: sanitizeLogValue(payload),
    error: sanitizeLogError(error),
  });
}

function withApiLogging(name, payload, runner) {
  return Promise.resolve()
    .then(() => runner())
    .then((result) => {
      logSuccess(name, payload, result);
      return result;
    })
    .catch((error) => {
      logError(name, payload, error);
      throw error;
    });
}

export function loadUserConfig() {
  return withApiLogging("LoadUserConfig", undefined, () => LoadUserConfig());
}

export function saveUserConfig(payload) {
  return withApiLogging("SaveUserConfig", payload, () => SaveUserConfig(payload));
}

export function exportUserConfig(path) {
  return withApiLogging("ExportUserConfig", { path }, () =>
    Call.ByName(`${PROXY_SERVICE_NAME}.ExportUserConfig`, path),
  );
}

export function importUserConfig(path) {
  return Call.ByName(`${PROXY_SERVICE_NAME}.ImportUserConfig`, path).then(
    (result) => {
      console.log(`${API_LOG_PREFIX} ImportUserConfig response`, {
        path,
        modelCount: Array.isArray(result?.modelAdapters) ? result.modelAdapters.length : 0,
      });
      return result;
    },
    (error) => {
      logError("ImportUserConfig", { path }, error);
      throw error;
    },
  );
}

export function getCursorAccountStatus() {
  return withApiLogging("GetCursorAccountStatus", undefined, () => GetCursorAccountStatus());
}

export function startCursorAccountLogin() {
  return withApiLogging("StartCursorAccountLogin", undefined, () => StartCursorAccountLogin());
}

export function disconnectCursorAccount() {
  return withApiLogging("DisconnectCursorAccount", undefined, () => DisconnectCursorAccount());
}

export function getProxyState() {
  return withApiLogging("GetState", undefined, () => GetState());
}

export function getHomeMetricsSummary() {
  return withApiLogging("GetHomeMetricsSummary", undefined, () => GetHomeMetricsSummary());
}

// lyh用cursor修改 2026-08-19：开机启动状态始终从操作系统读取，不使用页面缓存推断。
export function getStartupStatus() {
  return withApiLogging("GetStartupStatus", undefined, () =>
    Call.ByName(`${STARTUP_SERVICE_NAME}.GetStatus`),
  );
}

export function setStartupEnabled(enabled) {
  return withApiLogging("SetStartupEnabled", { enabled }, () =>
    Call.ByName(`${STARTUP_SERVICE_NAME}.SetEnabled`, enabled),
  );
}

export function startProxyService() {
  return withApiLogging("StartProxy", undefined, () => StartProxy());
}

export function stopProxyService() {
  return withApiLogging("StopProxy", undefined, () => StopProxy());
}

export function openLogsDirectory() {
  return withApiLogging("OpenHistoryWindow", undefined, () => OpenHistoryWindow());
}

export function openConfigWindow() {
  return withApiLogging("OpenConfigWindow", undefined, () => OpenConfigWindow());
}

export function getAppVersion() {
  return withApiLogging("GetAppVersion", undefined, () => GetAppVersion());
}

export function checkForUpdates() {
  return withApiLogging("CheckForUpdates", undefined, () => CheckForUpdates());
}

export function installReadyUpdate() {
  return withApiLogging("InstallReadyUpdate", undefined, () => InstallReadyUpdate());
}

export function openModelConfig() {
  return withApiLogging("OpenModelConfigWindow", undefined, () => OpenModelConfigWindow());
}

export function testModelAdapter(adapter) {
  return Call.ByName(`${PROXY_SERVICE_NAME}.TestModelAdapter`, adapter).then(
    (result) => {
      logSuccess("TestModelAdapter", adapter, result);
      return result;
    },
    (error) => {
      logError("TestModelAdapter", adapter, error);
      throw error;
    },
  );
}

export function getModelAdapterTestResults() {
  return withApiLogging("GetModelAdapterTestResults", undefined, () =>
    Call.ByName(`${PROXY_SERVICE_NAME}.GetModelAdapterTestResults`),
  );
}

export function fetchModelAdapterModels(payload) {
  return withApiLogging("FetchModelAdapterModels", payload, () =>
    Call.ByName(`${PROXY_SERVICE_NAME}.FetchModelAdapterModels`, payload),
  );
}
