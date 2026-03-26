use serde::{Deserialize, Serialize};
use std::fs;
use super::claude_dir;

#[derive(Debug, Serialize, Deserialize)]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub path: String,
    /// 是否为符号链接（symlink 到 ~/.agents/skills/）
    pub is_symlink: bool,
    /// SKILL.md 全文
    pub content: Option<String>,
}

/// 解析 SKILL.md frontmatter，提取 name 和 description
fn parse_frontmatter(text: &str) -> (String, String) {
    if !text.starts_with("---") {
        return (String::new(), String::new());
    }
    let rest = &text[3..];
    let end = rest.find("---").unwrap_or(rest.len());
    let frontmatter = &rest[..end];

    let mut name = String::new();
    let mut description = String::new();

    for line in frontmatter.lines() {
        if let Some(val) = line.strip_prefix("name:") {
            name = val.trim().trim_matches('"').to_string();
        } else if let Some(val) = line.strip_prefix("description:") {
            description = val.trim().trim_matches('"').to_string();
        }
    }
    (name, description)
}

/// 扫描 ~/.claude/skills/ 列出所有 skill
#[tauri::command]
pub fn list_skills() -> Result<Vec<Skill>, String> {
    let skills_dir = claude_dir().join("skills");
    if !skills_dir.exists() {
        return Ok(vec![]);
    }

    let mut skills = Vec::new();
    let entries = fs::read_dir(&skills_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        // 检测是否为 symlink
        let is_symlink = entry.path().is_symlink()
            || fs::symlink_metadata(&path)
                .map(|m| m.file_type().is_symlink())
                .unwrap_or(false);

        // 找 SKILL.md（不区分大小写）
        let skill_md = ["SKILL.md", "skill.md", "Skill.md"]
            .iter()
            .map(|f| path.join(f))
            .find(|p| p.exists());

        let dir_name = entry.file_name().to_string_lossy().to_string();

        if let Some(skill_file) = skill_md {
            let content = fs::read_to_string(&skill_file).unwrap_or_default();
            let (name, description) = parse_frontmatter(&content);
            skills.push(Skill {
                name: if name.is_empty() { dir_name } else { name },
                description,
                path: skill_file.to_string_lossy().to_string(),
                is_symlink,
                content: None, // list 时不返回全文，节省带宽
            });
        }
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

/// 读取单个 skill 的完整 SKILL.md 内容
#[tauri::command]
pub fn read_skill(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}
