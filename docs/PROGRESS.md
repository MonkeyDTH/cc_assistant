# CC Assistant 开发进度

**最后更新**：2026-03-26
**当前状态**：Phase 1 + Phase 2 + Phase 3 已完成

---

## 已完成

### Phase 1 — 骨架 + 仪表盘 ✅

- [x] Tauri v2 + React + TypeScript + Vite + Tailwind CSS 项目初始化（手动创建，非脚手架）
- [x] 字体方案：Outfit（UI）+ DM Mono（代码），CSS 变量主题系统
- [x] 侧边栏导航（7 个模块：Dashboard / Sessions / Prompt / Hooks / Skills / Plugins / Settings）
- [x] 主布局 MainLayout，路由通过 Zustand `activeNav` 状态切换（未使用 React Router）
- [x] 仪表盘 Dashboard：项目卡片网格，活跃进程徽章，统计条，刷新按钮
- [x] ProjectCard 组件：显示项目名/路径/会话数/最近时间，快捷操作按钮
- [x] Prompt 编辑器：CodeMirror + 实时预览，全局/项目模式切换，保存/备份
- [x] Rust 后端基础命令：`list_projects`, `get_active_sessions`, `list_sessions`, `read_conversation`, `read_settings`, `write_settings`, `read_global_claude_md`, `write_global_claude_md`, `read_project_claude_md`, `write_project_claude_md`
- [x] Tauri invoke 封装（`src/lib/tauri-api.ts`），含浏览器 mock 数据（开发时无需 Rust）
- [x] Zustand store（`src/stores/app-store.ts`）

### Phase 2 — 配置管理 ✅

- [x] **Skills 页**：扫描 `~/.claude/skills/`，解析 SKILL.md frontmatter，主从布局（左列表+右全文预览），区分 symlink
- [x] **Plugins 页**：读 `installed_plugins.json` + `plugin.json`，合并 `enabledPlugins` 状态，切换开关实时写入 `settings.json`
- [x] **Hooks 页**：完整表单编辑器（matcher / command / async），五种 Hook 事件，读写 `settings.json` hooks 字段，写前自动备份
- [x] **Settings 页**：模型选择、API Key 查看（脱敏）、权限规则预览，联通 `read_settings` / `write_settings`
- [x] Rust 新增命令：`list_skills`, `read_skill`, `list_plugins`, `set_plugin_enabled`, `read_hooks`, `write_hooks`
- [x] TypeScript 0 error，Vite 生产构建通过，Rust `cargo check` 通过

### Simplify 代码审查重构 ✅

- [x] Rust：提取 `read_settings_json` / `write_settings_json` / `settings_path` 共享函数，消除 hooks/plugins/settings 三处重复读写逻辑
- [x] Rust：修复 5 处 TOCTOU 反模式（先 `exists()` 再操作 → 直接操作处理 `NotFound`）
- [x] Rust：备份时间戳精度升至毫秒，避免同秒写入覆盖
- [x] 前端：提取 `src/lib/utils.ts`（`getProjectName` / `getProjectDir` / `formatRelativeTime`）
- [x] 前端：提取 `src/components/ui/LoadingSkeleton.tsx` 和 `SaveStatusBadge.tsx` 共享组件
- [x] 前端：`ProjectCard` 一次 `find` 替代 `some + find` 双重遍历
- [x] 前端：`PromptPage` / `HooksPage` 用 `useRef + useEffect` 清理 `setTimeout` 泄漏
- [x] 前端：`HooksPage` 去除冗余 `isDirty` state，改为从数据派生；`_id` 改用递增计数器
- [x] 前端：`tauri-api.ts` 模块级缓存 `tauriInvoke`，消除每次调用的 `await import`
- [x] CSS：新增 `--editor-bg` / `--editor-body` / `--editor-text` 变量，替换硬编码颜色

### Phase 3 — 会话和高级功能 ✅

- [x] **会话详情**：`ConversationDetail.tsx`，消息时间线（user/assistant 交替），thinking block 可折叠，tool_use / tool_result 可折叠展示 JSON
- [x] **历史搜索**：`SessionsPage` 新增「历史搜索」标签页，`BufReader` 流式读取 `history.jsonl`，支持实时关键词 + 项目路径过滤，最多返回 500 条
- [x] **Memory 管理**：`MemoryPage.tsx`，左侧按 type 过滤列表（user/feedback/project/reference），右侧 Markdown 编辑器，支持新建/保存/删除，自动同步 `MEMORY.md` 索引
- [x] **项目级 Settings**：`SettingsPage` 新增「项目级」标签页，JSON 编辑器直接读写 `<project>/.claude/settings.json`，含语法错误提示
- [x] **Prompt 页标签切换**：顶部新增 CLAUDE.md / Memory 两个标签，统一 Prompt 相关管理入口
- [x] Rust 新增命令：`list_memories`, `read_memory`, `write_memory`, `delete_memory`, `search_history`, `read_project_settings`, `write_project_settings`

---

## 待开发

### 剩余功能

- [ ] **插件市场浏览**：读 `known_marketplaces.json`，展示可用插件（联网或本地缓存）

### 其他待完善

- [ ] 生产图标替换（当前为占位 PNG，需正式设计）
- [ ] 代码分块（当前 index.js 约 800KB，需 dynamic import 拆分）
- [ ] 会话 JSONL 大文件分页读取（避免内存问题，当前全文加载）
- [ ] 文件监听（fs watch）：配置文件被外部修改时自动刷新 UI
- [ ] `app-store.ts` 中 `isProjectActive` 补充 TypeScript 类型签名

---

## 项目结构

```
cc_assistant/
├── src/                         # React 前端
│   ├── main.tsx                 # 入口
│   ├── App.tsx                  # 根组件
│   ├── index.css                # 全局样式 + CSS 变量主题
│   ├── lib/
│   │   ├── types.ts             # TypeScript 类型定义（含 ConversationRecord、MemoryEntry、HistoryEntry）
│   │   ├── tauri-api.ts         # Tauri invoke 封装 + 浏览器 mock
│   │   └── utils.ts             # 共享工具函数（路径处理、时间格式化）
│   ├── stores/
│   │   └── app-store.ts         # Zustand 全局状态
│   └── components/
│       ├── layout/
│       │   ├── Sidebar.tsx      # 左侧导航栏
│       │   └── MainLayout.tsx   # 主布局 + 页面路由
│       ├── ui/
│       │   ├── LoadingSkeleton.tsx  # 骨架屏组件
│       │   └── SaveStatusBadge.tsx  # 保存状态徽章
│       ├── dashboard/
│       │   ├── Dashboard.tsx    # 仪表盘页面
│       │   └── ProjectCard.tsx  # 项目卡片
│       ├── prompt/
│       │   └── PromptPage.tsx   # CLAUDE.md 编辑器（含 Memory 标签切换）
│       ├── memory/
│       │   └── MemoryPage.tsx   # Memory 管理（列表 + 编辑器）
│       ├── skills/
│       │   └── SkillsPage.tsx   # Skill 列表 + 全文查看
│       ├── plugins/
│       │   └── PluginsPage.tsx  # 插件管理 + 启用/禁用
│       ├── hooks/
│       │   └── HooksPage.tsx    # Hook 可视化编辑器
│       ├── sessions/
│       │   ├── SessionsPage.tsx        # 会话列表 + 历史搜索
│       │   └── ConversationDetail.tsx  # 会话详情（消息时间线）
│       └── settings/
│           └── SettingsPage.tsx # 全局设置 + 项目级 Settings
├── src-tauri/                   # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs               # Tauri 注册所有命令
│   │   └── commands/
│   │       ├── mod.rs               # claude_dir()、read/write_settings_json() 等共享工具
│   │       ├── projects.rs          # 项目扫描 + 会话读取
│   │       ├── settings.rs          # 全局 settings.json 读写
│   │       ├── prompt.rs            # CLAUDE.md 读写
│   │       ├── skills.rs            # skills 扫描 + 读取
│   │       ├── plugins.rs           # 插件列表 + 启用状态
│   │       ├── hooks.rs             # hooks 读写
│   │       ├── memory.rs            # Memory 文件管理 + MEMORY.md 索引同步
│   │       ├── history.rs           # history.jsonl 流式搜索
│   │       └── project_settings.rs  # 项目级 settings.json 读写
│   ├── icons/
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── docs/
│   ├── 20260326_CC_Assistant_设计文档.md
│   └── PROGRESS.md              # 本文件
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── postcss.config.js
```

---

## Git 提交历史

| Commit | 内容 |
|--------|------|
| `18f58c1` | feat: init — Phase 1 + Phase 2 初始实现 |
| `be2842f` | refactor: simplify — 消除重复逻辑，修复效率和质量问题 |
| `94fa255` | feat: Phase 3 — 会话详情、Memory 管理、历史搜索、项目级 Settings |

---

## 启动方式

```bash
# 浏览器开发预览（使用 mock 数据，无需 Rust）
npm run dev
# 访问 http://localhost:1420

# 完整 Tauri 桌面应用（读取真实 ~/.claude/ 数据）
npm run tauri dev

# 生产构建
npm run tauri build
```

---

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 桌面框架 | Tauri | v2 |
| 前端框架 | React | 18 |
| 语言 | TypeScript | 5.6 |
| 构建 | Vite | 6 |
| 样式 | Tailwind CSS | 3 |
| 状态管理 | Zustand | 5 |
| 代码编辑器 | CodeMirror (@uiw/react-codemirror) | 4 |
| 图标 | Lucide React | - |
| 后端语言 | Rust | 1.94 (Cargo) |
| 后端核心库 | Tauri v2 + serde_json + chrono + dirs | - |
