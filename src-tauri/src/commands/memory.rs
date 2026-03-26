use serde::{Deserialize, Serialize};
use std::fs;
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

/// 列出 ~/.claude/memory/ 下所有 memory 文件
#[tauri::command]
pub fn list_memories() -> Result<Vec<MemoryEntry>, String> {
    let memory_dir = claude_dir().join("memory");
    let entries = match fs::read_dir(&memory_dir) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(e.to_string()),
    };

    let mut memories = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name == "MEMORY.md" {
            continue; // 跳过索引文件
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
    Ok(memories)
}

/// 读取单个 memory 文件全文
#[tauri::command]
pub fn read_memory(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// 写入 memory 文件（新建或覆盖）并更新 MEMORY.md 索引
#[tauri::command]
pub fn write_memory(file_name: String, content: String) -> Result<(), String> {
    let memory_dir = claude_dir().join("memory");
    fs::create_dir_all(&memory_dir).map_err(|e| e.to_string())?;

    let file_path = memory_dir.join(&file_name);
    fs::write(&file_path, &content).map_err(|e| e.to_string())?;

    // 同步更新 MEMORY.md 索引中对应条目
    let (name, description, _) = parse_memory_frontmatter(&content);
    let index_path = claude_dir().join("MEMORY.md");
    let index = fs::read_to_string(&index_path).unwrap_or_default();

    let link = format!("- [{name}]({file_name})");
    let desc_part = if description.is_empty() {
        String::new()
    } else {
        // 截断到 100 字符
        let short: String = description.chars().take(100).collect();
        format!(" — {short}")
    };
    let new_line = format!("{link}{desc_part}");

    // 替换已有条目或追加
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

    fs::write(&index_path, updated + "\n").map_err(|e| e.to_string())
}

/// 删除 memory 文件并从 MEMORY.md 索引移除对应条目
#[tauri::command]
pub fn delete_memory(file_name: String) -> Result<(), String> {
    let memory_dir = claude_dir().join("memory");
    let file_path = memory_dir.join(&file_name);
    match fs::remove_file(&file_path) {
        Ok(_) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e.to_string()),
    }

    // 从 MEMORY.md 索引移除该条目
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
    Ok(())
}
