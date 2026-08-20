# 2026-08-20 GitHub 账号更名同步

## 修改内容

- `internal/buildinfo/buildinfo.go`：将 `ReleaseRepo`、`UpdateBaseURL`、`ReleasePageURL` 从 `helenwilkerson` 改为 `liangyearn`，确保应用内更新器从本人新账号拉取发布产物，不依赖旧用户名重定向。
- `Taskfile.yml`：将 `RELEASE_REPO` 改为 `liangyearn/cursor-byok`，保持发布任务目标仓库与更新器来源一致。
- `frontend/src/layouts/MainLayout.vue`：将页脚作者仓库链接改为新账号地址，避免界面入口跳转到旧用户名。

## 验证结果

- `编译`：成功。`go build ./...` 通过；`yarn build` 通过，114 个模块转换成功。
- `测试`：通过。`go test ./internal/updater/... ./internal/buildinfo/... ./internal/app/...` 通过。
- `静态检查`：通过。修改文件无新增 linter 诊断；全仓搜索确认已无 `helenwilkerson` 残留。

说明：`upstream` 远端与 README 中的 `leookun` 链接属于上游地址，未改动；`yhfx186` 为品牌署名，与 GitHub 用户名无关，保持原样。`origin` 远端地址仍指向旧用户名，属于 git 配置变更，未在未授权情况下执行。

# 2026-08-20 手工回归完成

## 修改内容

- `frontend/src/components/ModelEditor.vue`、`frontend/src/views/ModelConfig.vue`：完成模型编辑器单窗口模态架构的 Windows GUI 回归，连续打开、关闭、保存、取消和保存并测试约 30 次，无闪退或状态异常。
- `frontend/src/composables/useModelClipboardTransfer.js`、`frontend/src/utils/modelClipboardCrypto.js`：完成真实剪贴板加密导出、导入、错误口令和篡改密文回归，结果全部通过。
- `frontend/src/composables/useConfigTransfer.js`、`frontend/src/state/appState.js`：完成配置导入导出、代理出口、`routingMode`、开机启动和更新器回归，结果全部通过。

## 验证结果

- `Windows GUI 手工回归`：通过；模型编辑器重复约 30 次，未发现问题。
- `Wails 系统剪贴板`：通过；加密导出导入、错误口令和篡改密文均符合预期。
- `配置与运行功能`：通过；配置导入导出、代理、`routingMode`、开机启动和更新器均通过。
- `发现的问题`：无。

## 原有实现记录

## 已完成

- 同步上游 `e9d3845`，保留无广告、`Cursor助手` 品牌、主窗口 `635×820`、开机启动、出口代理与 `routingMode` 定制。
- 模型编辑迁移为主应用内单窗口模态架构；旧 `ModelEditorWindow`、`editorCtx` 与独立 WebView 桥接链路已移除。首页仍可通过 `OpenModelConfigWindow` 打开完整模型配置页，该窗口不再维护编辑器草稿生命周期。
- 新增单模型加密剪贴板协议：PBKDF2-SHA-256（310,000 次）派生 AES-256-GCM 密钥，每次导出随机生成 16 字节 salt 与 12 字节 nonce。
- 密文信封包含固定 magic、版本、算法、KDF 参数、salt、nonce 与 ciphertext；协议元数据参与 GCM 认证。
- 导入仅替换当前编辑草稿，编辑模式保留原 `id/sort`，新增模式保持未持久化状态；用户仍需显式点击保存。
- 口令输入支持密码框、导出二次确认、至少 8 字符校验；确认或取消后清理口令状态。
- 编辑器保存、保存并测试期间，父模态会根据编辑器忙碌事件禁用关闭按钮、遮罩关闭和 Esc 关闭，避免异步请求仍使用草稿时销毁组件。
- Windows manifest、Linux homepage、发布任务仓库与应用内更新器统一到当前 fork；版本保持 `0.0.48`。

## 自动化验证

- `yarn test`：11/11 通过。
- `yarn build`：通过；Vite 114 个模块转换成功，仅有既有的大 chunk 提示。
- `go test ./...`：通过。首次运行发现 Proto 生成物过期，按 `Taskfile` 参数重新生成后全部通过。
- `task build:windows:amd64`：通过，产物为 `bin/windows-64.zip`，大小约 20.2 MB。
- Windows 产物启动级冒烟：从压缩包解出并启动 `windows-64.exe`，运行约 5 秒后正常退出，退出码为 `0`；未执行交互点击回归。
- `git diff --name-only --diff-filter=U`：无未解决冲突。
- `git diff --check`：无空白错误，仅有工作区 LF/CRLF 转换提示。
- 全仓搜索确认不存在 `OpenModelEditorWindow`、`GetModelEditorContext`、`modelEditorWindow`、`editorCtx`、`openModelEditor` 残留。

## 手工回归

- 实际 Windows GUI 中连续打开、关闭、保存、取消和保存并测试约 30 次，通过，未发生闪退。
- Wails 系统剪贴板加密导出导入、错误口令和篡改密文验证通过。
- 完整配置导入导出、出口代理、`routingMode`、开机启动和更新器验证通过。
- 本轮手工回归未发现问题。

当前仍处于 `git merge --no-commit --no-ff e9d3845`，未创建提交。