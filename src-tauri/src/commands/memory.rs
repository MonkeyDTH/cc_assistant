use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use super::claude_dir;

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub file_name: String,
    pub path: String,
    pub name: String,
    pub description: String,
    pub memory_type: String,  // user / feedback / project / reference
    pub content: String,
}

/// 解析 memory 文件的 YAML frontmatter
fn parse_memory_frontmatter(text: &str) -> (String, String, String) {
    if !text.starts_with("---") {
        return (String::new(), String::new(), String::new());
    }
    let rest = &text[3..];
    let end = rest.find("---").unwrap_or(rest.len());
    let fm = &rest[..end];

    let mut name = String::new();
    let mut description = String::new();
    let mut memory_type = String::new();

    for line in fm.lines() {
        if let Some(v) = line.strip_prefix("name:") {
            name = v.trim().trim_matches('"').to_string();
        } else if let Some(v) = line.strip_prefix("description:") {
            description = v.trim().trim_matches('"').to_string();
        } else if let Some(v) = line.strip_prefix("type:") {
            memory_type = v.trim().trim_matches('"').to_string();
        }
    }
    (name, description, memory_type)
}

/// 根据 project_id 解析目标 memory 目录
/// project_id 为 None/空字符串 → 全局 ~/.claude/memory/
/// project_id 有值 → ~/.claude/projects/<id>/memory/
fn resolve_memory_dir(project_id: &Option<String>) -> PathBuf {
    match project_id {
        Some(pid) if !pid.is_empty() => {
            claude_dir().join("projects").join(pid).join("memory")
        }
        _ => claude_dir().join("memory"),
    }
}

/// 从指定目录读取所有 .md memory 文件（跳过 MEMORY.md 索引）
fn read_memories_from_dir(dir: &Path) -> Vec<MemoryEntry> {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    let mut memories = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name == "MEMORY.md" {
            continue;
        }
        let content = fs::read_to_string(&path).unwrap_or_default();
        let (name, description, memory_type) = parse_memory_frontmatter(&content);
        memories.push(MemoryEntry {
            file_name,
            path: path.to_string_lossy().to_string(),
            name,
            description,
            memory_type,
            content,
        });
    }
    memories.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    memories
}

/// 列出 memory 文件
/// project_id 为空 → 全局目录（含 ~/.claude/MEMORY.md）；有值 → 该项目目录
#[tauri::command]
pub fn list_memories(project_id: Option<String>) -> Result<Vec<MemoryEntry>, String> {
    let is_global = project_id.as_deref().unwrap_or("").is_empty();
    let dir = resolve_memory_dir(&project_id);
    let mut memories = read_memories_from_dir(&dir);

    // 全局模式：额外读取 ~/.claude/MEMORY.md（索引/平铺格式的全局记忆）
    if is_global {
        let index_path = claude_dir().join("MEMORY.md");
        if let Ok(content) = fs::read_to_string(&index_path) {
            if !content.trim().is_empty() {
                let (name, description, memory_type) = parse_memory_frontmatter(&content);
                memories.insert(0, MemoryEntry {
                    file_name: "MEMORY.md".to_string(),
                    path: index_path.to_string_lossy().to_string(),
                    name: if name.is_empty() { "全局索引".to_string() } else { name },
                    description: if description.is_empty() {
                        "~/.claude/MEMORY.md".to_string()
                    } else {
                        description
                    },
                    memory_type: if memory_type.is_empty() { "reference".to_string() } else { memory_type },
                    content,
                });
            }
        }
    }

    Ok(memories)
}

/// 读取单个 memory 文件全文
#[tauri::command]
pub fn read_memory(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// 写入 memory 文件（新建或覆盖），全局模式下同步更新 MEMORY.md 索引
#[tauri::command]
pub fn write_memory(
    file_name: String,
    content: String,
    project_id: Option<String>,
) -> Result<(), String> {
    let is_global = project_id.as_deref().unwrap_or("").is_empty();

    // MEMORY.md 是特殊的全局索引文件，直接写到 ~/.claude/MEMORY.md，不走子目录
    if file_name == "MEMORY.md" && is_global {
        let index_path = claude_dir().join("MEMORY.md");
        return fs::write(&index_path, &content).map_err(|e| e.to_string());
    }

    let memory_dir = resolve_memory_dir(&project_id);
    fs::create_dir_all(&memory_dir).map_err(|e| e.to_string())?;

    let file_path = memory_dir.join(&file_name);
    fs::write(&file_path, &content).map_err(|e| e.to_string())?;

    // 仅全局 memory 更新 ~/.claude/MEMORY.md 索引
    let is_global = project_id.as_deref().unwrap_or("").is_empty();
    if is_global {
        let (name, description, _) = parse_memory_frontmatter(&content);
        let index_path = claude_dir().join("MEMORY.md");
        let index = fs::read_to_string(&index_path).unwrap_or_default();

        let link = format!("- [{name}]({file_name})");
        let desc_part = if description.is_empty() {
            String::new()
        } else {
            let short: String = description.chars().take(100).collect();
            format!(" — {short}")
        };
        let new_line = format!("{link}{desc_part}");

        let needle = format!("({file_name})");
        let updated = if index.lines().any(|l| l.contains(&needle)) {
            index
                .lines()
                .map(|l| if l.contains(&needle) { new_line.as_str() } else { l })
                .collect::<Vec<_>>()
                .join("\n")
        } else {
            format!("{}\n{}", index.trim_end(), new_line)
        };

        fs::write(&index_path, updated + "\n").map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// 删除 memory 文件，全局模式下同步从 MEMORY.md 索引移除
#[tauri::command]
pub fn delete_memory(file_name: String, project_id: Option<String>) -> Result<(), String> {
    let is_global = project_id.as_deref().unwrap_or("").is_empty();

    // MEMORY.md 不允许删除（是全局索引文件）
    if file_name == "MEMORY.md" && is_global {
        return Ok(());
    }

    let memory_dir = resolve_memory_dir(&project_id);
    let file_path = memory_dir.join(&file_name);
    match fs::remove_file(&file_path) {
        Ok(_) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e.to_string()),
    }

    // 仅全局 memory 更新索引
    let is_global = project_id.as_deref().unwrap_or("").is_empty();
    if is_global {
        let index_path = claude_dir().join("MEMORY.md");
        if let Ok(index) = fs::read_to_string(&index_path) {
            let needle = format!("({file_name})");
            let updated: String = index
                .lines()
                .filter(|l| !l.contains(&needle))
                .collect::<Vec<_>>()
                .join("\n");
            fs::write(&index_path, updated + "\n").map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
