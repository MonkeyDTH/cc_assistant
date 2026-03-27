# CC Assistant

Claude Code 的桌面管理面板。提供可视化界面统一管理 Claude Code 的配置、会话、Skills、Plugins、Hooks 和 Memory，无需手动编辑 JSON/Markdown 文件。

## 功能一览

| 模块 | 功能 |
|------|------|
| **仪表盘** | 多项目卡片网格，显示会话数、最近活跃时间、活跃会话状态，30s 自动刷新 |
| **Prompt** | 可视化编辑全局及项目级 `CLAUDE.md`，CodeMirror 编辑器 + 实时预览 |
| **Memory** | 浏览/新建/编辑/删除 `~/.claude/memory/*.md`，按 type 过滤，自动同步 `MEMORY.md` 索引 |
| **Sessions** | 会话历史列表，点击查看完整消息时间线（含 thinking block、tool use 折叠展示）；历史搜索标签可全文搜索 `history.jsonl` |
| **Skills** | 扫描 `~/.claude/skills/`，主从布局查看 SKILL.md 全文，区分本地安装与符号链接 |
| **Plugins** | 已安装插件管理（启用/禁用开关）+ 市场浏览（扫描本地缓存，支持关键词搜索、安装状态过滤） |
| **Hooks** | 可视化表单编辑 `settings.json` 中的 hooks（支持 Notification / Stop / PreToolUse 等五种事件，matcher / command / async 完整配置） |
| **Settings** | 全局设置（模型选择、API Key 查看、权限规则预览）+ 项目级 `.claude/settings.json` JSON 编辑器 |

所有配置直接读写 `~/.claude/` 下的文件，写入前自动备份，不引入额外数据库。

## 环境要求

| 工具 | 版本要求 |
|------|---------|
| Node.js | >= 18 |
| Rust / Cargo | >= 1.70 |
| [Tauri 系统依赖](https://tauri.app/start/prerequisites/) | 见官方文档 |

> Windows 用户需额外安装 Microsoft C++ Build Tools 和 WebView2。

## 开发运行

```bash
# 1. 克隆项目
git clone <repo-url>
cd cc_assistant

# 2. 安装前端依赖
npm install

# 3a. 浏览器预览（使用内置 mock 数据，无需 Rust 编译）
npm run dev
# 访问 http://localhost:1420

# 3b. 完整桌面应用（读取真实 ~/.claude/ 数据）
npm run tauri dev
```

## 生产构建

```bash
npm run tauri build
```

构建产物在 `src-tauri/target/release/bundle/` 下，包含 `.exe`（Windows）/ `.dmg`（macOS）/ `.AppImage`（Linux）。

## 技术栈

- **桌面框架**：Tauri v2（Rust 后端，直接读写本地文件系统）
- **前端**：React 18 + TypeScript + Vite 6
- **样式**：Tailwind CSS 3，自定义 CSS 变量主题
- **状态管理**：Zustand 5
- **代码编辑器**：CodeMirror 6（`@uiw/react-codemirror`）
- **构建优化**：Vite `manualChunks` 分块 + `React.lazy` 懒加载，首屏入口 ~16KB

## 项目结构

```
cc_assistant/
├── src/                    # React 前端
│   ├── components/         # 页面组件
│   │   ├── dashboard/      # 仪表盘
│   │   ├── prompt/         # CLAUDE.md 编辑器
│   │   ├── memory/         # Memory 管理
│   │   ├── sessions/       # 会话列表 + 详情
│   │   ├── skills/         # Skills 浏览
│   │   ├── plugins/        # 插件管理 + 市场
│   │   ├── hooks/          # Hooks 编辑器
│   │   ├── settings/       # 全局 + 项目级设置
│   │   ├── layout/         # 侧边栏 + 主布局
│   │   └── ui/             # 共享 UI 组件
│   ├── lib/
│   │   ├── tauri-api.ts    # Tauri 命令封装（含浏览器 mock）
│   │   ├── types.ts        # TypeScript 类型定义
│   │   └── utils.ts        # 路径处理、时间格式化等工具函数
│   └── stores/
│       └── app-store.ts    # Zustand 全局状态
├── src-tauri/              # Rust 后端
│   └── src/commands/       # Tauri 命令（每个功能模块一个文件）
├── docs/                   # 设计文档 + 开发进度
└── vite.config.ts          # 构建配置（含分块策略）
```

## 注意事项

- 应用直接读写 `~/.claude/` 下的配置文件，保存前会自动在 `~/.claude/backups/` 创建带毫秒时间戳的备份
- `npm run dev` 浏览器模式使用内置 mock 数据，适合前端开发调试；`npm run tauri dev` 才会读取本机真实 Claude Code 数据
- 插件市场「浏览」功能依赖本地已同步的 marketplace 缓存（`~/.claude/plugins/marketplaces/`），安装插件仍需通过 Claude Code CLI
