# Changelog

## v0.5.1 - 2026-04-10

✨ 新功能
- Hooks 页面支持事件分组展示与说明文字

🔧 其他
- bump version to v0.5.1

## v0.5.0 - 2026-04-08

✨ 新功能
- Profile 支持额外环境变量，完善切换同步逻辑
- 新增 API Profile 管理与快捷切换功能

🐛 修复
- 侧边栏版本号改为从 package.json 编译时读取

🔧 其他
- bump version to v0.5.0
- 移除 docs 目录（本地保留，不纳入版本控制）
- 新增 GitHub Actions 自动构建发版 workflow

## v0.4.0 - 2026-03-31

✨ 新功能
- 会话列表支持删除会话（带二次确认）
- 会话列表支持一键激活所在终端窗口
- 模型配置页展示 ANTHROPIC_BASE_URL 和 ANTHROPIC_API_KEY

🔧 其他
- bump version to v0.4.0
- 新增自动发版脚本

## v0.3.0 - 2026-03-30

✨ 新功能
- 权限规则支持三 Block 独立编辑（允许/拒绝/询问），各自支持新增、行内编辑、删除
- 将模型配置和权限管理恢复为独立侧边栏 Tab

🐛 修复
- 修复同一进程 /clear 后会话重复显示的问题

## v0.2.0 - 2026-03-27

✨ 新功能
- 将 Memory 拆分为独立页面并区分全局/项目模式
- 精准活跃会话检测与跨组件导航

🐛 修复
- 修复未使用变量导致的 TS 编译错误
- 统一术语并修复项目选择器交互
- 修正项目路径解码逻辑及 CLAUDE.md 读写路径
- 修复 Tauri IPC 参数命名及会话加载的多个 Bug

## v0.1.0 - 2026-03-26

✨ 新功能
- init CC Assistant — Tauri + React Claude Code 管理面板
- Phase 3 — 会话详情、Memory 管理、历史搜索、项目级 Settings
- 代码分块、插件市场、文件监听、JSONL分页、类型修复

🔧 其他
- simplify — 消除重复逻辑，修复效率和质量问题
- 更新应用图标并修复 Tauri 相关配置
