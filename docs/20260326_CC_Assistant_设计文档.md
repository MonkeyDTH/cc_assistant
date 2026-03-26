# CC Assistant — Claude Code 管理面板

**日期**：2026-03-26
**状态**：设计稿，待实现

---

## 一、背景与动机

Claude Code 的配置散落在 `~/.claude/` 下的多个文件和目录中：settings.json、CLAUDE.md、skills/、plugins/、projects/ 等。日常管理需要手动编辑 JSON/Markdown，对非 CLI 用户不够友好，也没有全局视图来概览多个项目的会话状态。

**目标**：一个轻量桌面应用，提供可视化界面来管理 Claude Code 的所有配置和会话。

---

## 二、技术选型

| 项目 | 选择 | 理由 |
|------|------|------|
| 框架 | Tauri v2 | 轻量（~5MB 包体）、Rust 后端可直接读写文件系统 |
| 前端 | React + TypeScript | 生态成熟，组件丰富 |
| UI 库 | Shadcn/ui + Tailwind CSS | 现代设计，可定制性强 |
| 状态管理 | Zustand | 轻量、函数式风格 |
| 构建 | Vite | 快速 HMR |

---

## 三、核心数据模型

应用直接读写 `~/.claude/` 下的文件，不引入额外数据库。

### 3.1 数据源映射

| 功能模块 | 读写路径 | 格式 |
|---------|---------|------|
| 全局设置（API Key、模型、权限、Hooks） | `~/.claude/settings.json` | JSON |
| 全局 Prompt | `~/.claude/CLAUDE.md` | Markdown |
| 项目级 Prompt | `<project>/.claude/CLAUDE.md` | Markdown |
| Memory | `~/.claude/MEMORY.md` + `~/.claude/memory/*.md` | MD + YAML frontmatter |
| 已安装 Skills | `~/.claude/skills/<name>/SKILL.md` | MD + YAML frontmatter |
| 已安装插件 | `~/.claude/plugins/installed_plugins.json` | JSON |
| 插件市场注册 | `~/.claude/plugins/known_marketplaces.json` | JSON |
| 插件元信息 | `~/.claude/plugins/cache/<mkt>/<name>/<ver>/.claude-plugin/plugin.json` | JSON |
| 活跃会话 | `~/.claude/sessions/<pid>.json` | JSON |
| 项目列表 | `~/.claude/projects/` 目录名 | 编码路径 |
| 会话记录 | `~/.claude/projects/<encoded-path>/<uuid>.jsonl` | JSONL |
| 输入历史 | `~/.claude/history.jsonl` | JSONL |

### 3.2 项目路径编码规则

目录名 = 原始路径中 `\` 和 `/` 替换为 `-`，`:` 去掉。
例：`D:\Projects\Personal\cc_assistant` → `D--Projects-Personal-cc_assistant`

---

## 四、功能模块设计

### 4.1 仪表盘（Dashboard）

**首页概览，一眼看到所有项目状态。**

- 项目卡片列表（从 `projects/` 目录扫描）
  - 项目路径（解码显示）
  - 最近会话时间
  - 会话总数
  - 活跃会话指示（关联 `sessions/<pid>.json`）
  - 是否有项目级 CLAUDE.md
- 快速操作：打开项目目录、查看会话、编辑项目 CLAUDE.md

### 4.2 Prompt 管理

**管理全局和项目级 CLAUDE.md。**

- 全局 CLAUDE.md 编辑器（Markdown 编辑 + 实时预览）
- 项目级 CLAUDE.md 列表和编辑
- Memory 管理
  - 查看 MEMORY.md 索引
  - 浏览/编辑/删除 `memory/*.md` 文件
  - 新建 memory 条目（带 frontmatter 模板）
  - 按 type 过滤（user / feedback / project / reference）

### 4.3 Skill 管理

**浏览、查看已安装 Skills。**

- 已安装 Skill 列表
  - 解析 SKILL.md frontmatter 显示 name、description
  - 区分本地 Skill 和符号链接 Skill
  - 查看/编辑 SKILL.md 内容
- Skill 详情页：完整 Markdown 渲染

### 4.4 插件管理

**管理已安装插件和市场源。**

- 已安装插件列表（读 `installed_plugins.json`）
  - 名称、版本、安装时间、来源市场
  - 插件详情（读 plugin.json）
  - 启用/禁用状态（映射 `settings.json` 的 `enabledPlugins`）
- 市场源管理（读写 `known_marketplaces.json`）
  - 查看已注册市场
  - 添加/删除市场源

### 4.5 Hook 管理

**可视化编辑 settings.json 中的 hooks 配置。**

hooks 结构：
```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "可选的匹配规则",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c '...'",
            "async": true|false
          }
        ]
      }
    ]
  }
}
```

- Hook 事件类型列表（Notification、Stop、PreToolUse、PostToolUse 等）
- 每个事件下的 hook 规则列表
- 表单式编辑：事件类型、matcher、command、async 开关
- 命令预览和语法高亮
- 新增/删除/排序 hook 规则

### 4.6 会话管理

**浏览各项目的历史会话记录。**

- 按项目分组的会话列表
- 每个会话显示：
  - 开始时间（从 JSONL 首行 timestamp）
  - 消息数量
  - 首条用户消息摘要
  - 使用的模型
- 会话详情：消息时间线（用户/助手交替显示）
- 搜索功能：全文搜索历史输入（基于 `history.jsonl`）

### 4.7 全局设置

**编辑 settings.json 的其他配置。**

- 环境变量管理（`env` 字段，敏感值脱敏显示）
- 权限管理（`permissions.allow` / `deny` / `ask`）
- 模型选择
- 原始 JSON 编辑器（高级用户 fallback）

---

## 五、应用架构

```
cc_assistant/
├── src-tauri/             # Rust 后端
│   ├── src/
│   │   ├── main.rs        # 入口
│   │   ├── commands/      # Tauri commands（暴露给前端的 API）
│   │   │   ├── settings.rs    # 读写 settings.json
│   │   │   ├── prompt.rs      # 读写 CLAUDE.md、memory
│   │   │   ├── skills.rs      # 扫描/读写 skills
│   │   │   ├── plugins.rs     # 读写插件配置
│   │   │   ├── sessions.rs    # 扫描会话和项目
│   │   │   └── hooks.rs       # hooks 专用操作
│   │   └── utils/
│   │       ├── paths.rs       # 路径解码/编码
│   │       └── file_ops.rs    # 通用文件操作
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                   # React 前端
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── layout/        # 侧边栏、顶栏
│   │   ├── dashboard/     # 仪表盘组件
│   │   ├── prompt/        # Prompt 编辑器
│   │   ├── skills/        # Skill 列表/详情
│   │   ├── plugins/       # 插件管理
│   │   ├── hooks/         # Hook 编辑器
│   │   ├── sessions/      # 会话浏览器
│   │   └── settings/      # 全局设置
│   ├── stores/            # Zustand stores
│   ├── lib/               # 工具函数
│   │   ├── tauri-api.ts   # 封装 Tauri invoke 调用
│   │   └── types.ts       # TypeScript 类型定义
│   └── styles/
├── docs/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── index.html
```

### 前后端通信

前端通过 `@tauri-apps/api` 的 `invoke()` 调用 Rust 命令：

```typescript
// 前端调用示例
const settings = await invoke<Settings>('read_settings');
await invoke('write_hooks', { hooks: updatedHooks });
const projects = await invoke<Project[]>('list_projects');
```

```rust
// Rust 命令示例
#[tauri::command]
fn read_settings() -> Result<Settings, String> {
    let path = dirs::home_dir().unwrap().join(".claude/settings.json");
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}
```

---

## 六、实现路线（分阶段）

### Phase 1 — 骨架 + 仪表盘（MVP）
1. 初始化 Tauri + React + Vite 项目
2. 搭建侧边栏布局（Dashboard / Prompt / Skills / Plugins / Hooks / Sessions / Settings）
3. 实现项目扫描和仪表盘卡片
4. 全局 CLAUDE.md 查看/编辑

### Phase 2 — 配置管理
5. Settings.json 读写（环境变量、权限、模型）
6. Hook 可视化编辑器
7. Skill 浏览/查看
8. 插件列表和启用/禁用

### Phase 3 — 会话和高级功能
9. 会话列表和详情查看
10. 历史搜索
11. Memory 管理
12. 项目级 CLAUDE.md 编辑

---

## 七、验证方式

- Phase 1：能在仪表盘看到本地所有 Claude Code 项目，能编辑全局 CLAUDE.md 并保存
- Phase 2：能通过 GUI 修改 hooks/permissions 并验证 `settings.json` 正确更新
- Phase 3：能浏览任意项目的历史会话消息

每阶段验证后再进入下一阶段。

---

## 八、注意事项

1. **文件安全**：写入前备份原文件（利用已有的 `~/.claude/backups/`）
2. **并发安全**：Claude Code 可能同时运行并修改配置，写入时使用读-改-写模式并做冲突检测
3. **敏感信息**：API Key 等字段在 UI 中脱敏显示，复制时需二次确认
4. **编码问题**：Windows 路径中的中文需正确处理 UTF-8
5. **文件监听**：使用 Tauri 的 fs watch 监听配置文件变化，实时刷新 UI
