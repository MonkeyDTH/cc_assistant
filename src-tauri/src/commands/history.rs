use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use super::claude_dir;

#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub display: String,
    pub timestamp: u64,
    pub project: Option<String>,
    pub session_id: Option<String>,
}

/// 搜索 ~/.claude/history.jsonl
/// - query: 关键词（空则返回最近 N 条）
/// - project_filter: 按项目路径前缀过滤（空则不过滤）
/// - limit: 最多返回条数
#[tauri::command]
pub fn search_history(
    query: String,
    project_filter: String,
    limit: usize,
) -> Result<Vec<HistoryEntry>, String> {
    let path = claude_dir().join("history.jsonl");
    let file = match fs::File::open(&path) {
        Ok(f) => f,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(e.to_string()),
    };

    let q = query.to_lowercase();
    let pf = project_filter.to_lowercase();

    let mut results: Vec<HistoryEntry> = BufReader::new(file)
        .lines()
        .flatten()
        .filter_map(|line| {
            let v: serde_json::Value = serde_json::from_str(&line).ok()?;
            let display = v["display"].as_str()?.to_string();
            let timestamp = v["timestamp"].as_u64().unwrap_or(0);
            let project = v["project"].as_str().map(|s| s.to_string());
            let session_id = v["sessionId"].as_str().map(|s| s.to_string());

            // 关键词过滤
            if !q.is_empty() && !display.to_lowercase().contains(&q) {
                return None;
            }
            // 项目过滤
            if !pf.is_empty() {
                let proj = project.as_deref().unwrap_or("").to_lowercase();
                if !proj.contains(&pf) {
                    return None;
                }
            }
            Some(HistoryEntry { display, timestamp, project, session_id })
        })
        .collect();

    // 按时间降序，取前 limit 条
    results.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    results.truncate(limit.max(1).min(500));
    Ok(results)
}
