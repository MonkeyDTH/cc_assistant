#!/usr/bin/env node
// 发版脚本：自动生成 changelog，打 annotated tag
// 用法：npm run release
// 前提：先手动更新 package.json 中的版本号

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── 工具函数 ────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();
}

function log(msg) {
  console.log(msg);
}

// ── 读取版本号 ───────────────────────────────────────────────────────────────

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;
const tag = `v${version}`;
const today = new Date().toISOString().slice(0, 10);

// 检查 tag 是否已存在
try {
  run(`git rev-parse ${tag}`);
  console.error(`❌ Tag ${tag} 已存在，请先更新 package.json 中的版本号`);
  process.exit(1);
} catch {
  // tag 不存在，正常继续
}

log(`\n📦 准备发布 ${tag}...\n`);

// ── 找上一个 tag ─────────────────────────────────────────────────────────────

let prevTag;
try {
  prevTag = run('git describe --tags --abbrev=0');
} catch {
  prevTag = null; // 第一个版本，没有上一个 tag
}

const range = prevTag ? `${prevTag}..HEAD` : 'HEAD';
log(`📋 收集 ${prevTag ? prevTag : '初始提交'} → HEAD 的变更...\n`);

// ── 收集 commit ──────────────────────────────────────────────────────────────

const rawLog = run(`git log ${range} --format="%s"`);
const subjects = rawLog
  .split('\n')
  .map(s => s.trim())
  .filter(s => s.length > 0)
  // 过滤掉发版 commit 自身和无意义条目
  .filter(s => !s.startsWith('chore: release'))
  .filter(s => !s.startsWith('Merge '));

// ── 按类型分组 ───────────────────────────────────────────────────────────────

const groups = {
  feat:  { emoji: '✨', label: '新功能', items: [] },
  fix:   { emoji: '🐛', label: '修复',   items: [] },
  other: { emoji: '🔧', label: '其他',   items: [] },
};

const CONVENTIONAL_RE = /^(\w+)(\(.+?\))?!?:\s*(.+)$/;

for (const subject of subjects) {
  const m = subject.match(CONVENTIONAL_RE);
  if (!m) {
    groups.other.items.push(subject);
    continue;
  }
  const [, type, , desc] = m;
  if (type === 'feat') {
    groups.feat.items.push(desc);
  } else if (type === 'fix') {
    groups.fix.items.push(desc);
  } else {
    groups.other.items.push(desc);
  }
}

// ── 生成 changelog 文本 ──────────────────────────────────────────────────────

function renderGroup(group) {
  if (group.items.length === 0) return '';
  const lines = [`${group.emoji} ${group.label}`];
  for (const item of group.items) {
    lines.push(`- ${item}`);
  }
  return lines.join('\n');
}

const sections = [
  renderGroup(groups.feat),
  renderGroup(groups.fix),
  renderGroup(groups.other),
].filter(Boolean);

if (sections.length === 0) {
  console.error('❌ 没有找到任何 commit，请检查是否已有新的提交');
  process.exit(1);
}

const changelogBody = sections.join('\n\n');
const changelogEntry = `## ${tag} - ${today}\n\n${changelogBody}`;
const tagMessage = `${tag} - ${today}\n\n${changelogBody}`;

// ── 更新 CHANGELOG.md ────────────────────────────────────────────────────────

const changelogPath = join(ROOT, 'CHANGELOG.md');
const header = '# Changelog\n';
const existing = existsSync(changelogPath)
  ? readFileSync(changelogPath, 'utf8').replace(header, '').trimStart()
  : '';

const newContent = `${header}\n${changelogEntry}\n\n${existing}`.trimEnd() + '\n';
writeFileSync(changelogPath, newContent, 'utf8');
log('✅ CHANGELOG.md 已更新\n');
log('─'.repeat(50));
log(changelogEntry);
log('─'.repeat(50) + '\n');

// ── git commit + annotated tag ───────────────────────────────────────────────

run('git add CHANGELOG.md');
run(`git commit -m "chore: release ${tag}"`);
log(`✅ 已提交 CHANGELOG.md`);

run(`git tag -a ${tag} -m "${tagMessage.replace(/"/g, '\\"')}"`);
log(`✅ 已创建 annotated tag ${tag}\n`);

// ── 提示后续操作 ─────────────────────────────────────────────────────────────

log('🚀 发版准备完成！执行以下命令推送：\n');
log(`  git push && git push origin ${tag}\n`);
