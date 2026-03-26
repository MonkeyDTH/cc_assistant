# CC Assistant 开发进度

**最后更新**：2026-03-26
**当前状态**：Phase 1 + Phase 2 已完成，Phase 3 待开发

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

---

## 待开发

### Phase 3 — 会话和高级功能

- [ ] **会话详情**：点击会话条目，展开完整消息时间线（user/assistant 交替），渲染 thinking block、tool use
- [ ] **历史搜索**：全文搜索 `history.jsonl`，按关键词/项目筛选
- [ ] **Memory 管理**：列出 `~/.claude/memory/*.md`，按 type 过滤（user/feedback/project/reference），编辑/新建/删除
- [ ] **项目级 Settings**：读写 `<project>/.claude/settings.json`（权限覆盖、Hooks 覆盖）
- [ ] **插件市场浏览**：读 `known_marketplaces.json`，展示可用插件（联网或本地缓存）

### 其他待完善

- [ ] 生产图标替换（当前为占位 PNG，需正式设计）
- [ ] 代码分块（当前 index.js 810KB，需 dynamic import）
- [ ] 会话 JSONL 大文件分页读取（避免内存问题）
- [ ] 文件监听（fs watch）：配置文件被外部修改时自动刷新 UI

---

## 项目结构

```
cc_assistant/
├── src/                         # React 前端
│   ├── main.tsx                 # 入口
│   ├── App.tsx                  # 根组件
│   ├── index.css                # 全局样式 + CSS 变量主题
│   ├── lib/
│   │   ├── types.ts             # TypeScript 类型定义
│   │   └── tauri-api.ts         # Tauri invoke 封装 + 浏览器 mock
│   ├── stores/
│   │   └── app-store.ts         # Zustand 全局状态
│   └── components/
│       ├── layout/
│       │   ├── Sidebar.tsx      # 左侧导航栏
│       │   └── MainLayout.tsx   # 主布局 + 页面路由
│       ├── dashboard/
│       │   ├── Dashboard.tsx    # 仪表盘页面
│       │   └── ProjectCard.tsx  # 项目卡片
│       ├── prompt/
│       │   └── PromptPage.tsx   # CLAUDE.md 编辑器
│       ├── skills/
│       │   └── SkillsPage.tsx   # Skill 列表 + 全文查看
│       ├── plugins/
│       │   └── PluginsPage.tsx  # 插件管理 + 启用/禁用
│       ├── hooks/
│       │   └── HooksPage.tsx    # Hook 可视化编辑器
│       ├── sessions/
│       │   └── SessionsPage.tsx # 会话历史列表
│       └── settings/
│           └── SettingsPage.tsx # 全局设置
├── src-tauri/                   # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs               # Tauri 注册所有命令
│   │   └── commands/
│   │       ├── mod.rs           # claude_dir() 工具函数
│   │       ├── projects.rs      # 项目扫描 + 会话读取
│   │       ├── settings.rs      # settings.json 读写
│   │       ├── prompt.rs        # CLAUDE.md 读写
│   │       ├── skills.rs        # skills 扫描 + 读取
│   │       ├── plugins.rs       # 插件列表 + 启用状态
│   │       └── hooks.rs         # hooks 读写
│   ├── icons/                   # 应用图标（当前为占位）
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
| 后端核心库 | Tauri v2 + serde_json + chrono + walkdir + dirs | - |
