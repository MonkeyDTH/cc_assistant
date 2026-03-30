/**
 * 权限规则 CRUD 逻辑测试脚本
 * 运行：node scripts/test-permissions.mjs
 */

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    console.error(`    期望: ${JSON.stringify(expected)}`);
    console.error(`    实际: ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ——— 复现组件中的纯逻辑 ———

function confirmAdd(items, value) {
  const v = value.trim();
  if (v && !items.includes(v)) return [...items, v];
  return items; // 空值或重复不变
}

function confirmEdit(items, idx, value) {
  const v = value.trim();
  if (!v) return items;
  const next = [...items];
  next[idx] = v;
  return next;
}

function removeItem(items, idx) {
  return items.filter((_, i) => i !== idx);
}

function handleChange(perms, kind, items) {
  return { ...perms, [kind]: items };
}

// ========== 测试用例 ==========

console.log("\n── 新增规则 ──");
{
  let items = [];

  items = confirmAdd(items, "Bash");
  assertEqual(items, ["Bash"], "添加第一条规则");

  items = confirmAdd(items, "Read");
  assertEqual(items, ["Bash", "Read"], "添加第二条规则");

  items = confirmAdd(items, "  Bash  "); // 重复（trim 后）
  assertEqual(items, ["Bash", "Read"], "重复规则不添加");

  items = confirmAdd(items, "   "); // 空白
  assertEqual(items, ["Bash", "Read"], "空白字符串不添加");

  items = confirmAdd(items, "Write");
  assertEqual(items, ["Bash", "Read", "Write"], "添加第三条规则");
}

console.log("\n── 编辑规则 ──");
{
  let items = ["Bash", "Read", "Write"];

  items = confirmEdit(items, 1, "Edit");
  assertEqual(items, ["Bash", "Edit", "Write"], "编辑中间项");

  items = confirmEdit(items, 0, "  Glob  "); // 带空格
  assertEqual(items, ["Glob", "Edit", "Write"], "编辑时 trim 空格");

  items = confirmEdit(items, 2, "   "); // 空值不生效
  assertEqual(items, ["Glob", "Edit", "Write"], "编辑为空时不变");

  items = confirmEdit(items, 0, items[0]); // 编辑为相同值
  assertEqual(items, ["Glob", "Edit", "Write"], "编辑为原值不变");
}

console.log("\n── 删除规则 ──");
{
  let items = ["Bash", "Read", "Write"];

  items = removeItem(items, 1);
  assertEqual(items, ["Bash", "Write"], "删除中间项");

  items = removeItem(items, 0);
  assertEqual(items, ["Write"], "删除第一项");

  items = removeItem(items, 0);
  assertEqual(items, [], "删除最后一项");
}

console.log("\n── Permissions 对象合并（三 Block 各自独立） ──");
{
  let perms = { allow: [], deny: [], ask: [] };

  // 分别操作三个 kind
  perms = handleChange(perms, "allow", confirmAdd(perms.allow ?? [], "Bash"));
  perms = handleChange(perms, "deny",  confirmAdd(perms.deny  ?? [], "Write"));
  perms = handleChange(perms, "ask",   confirmAdd(perms.ask   ?? [], "Edit"));

  assertEqual(perms.allow, ["Bash"],  "allow 独立修改");
  assertEqual(perms.deny,  ["Write"], "deny 独立修改");
  assertEqual(perms.ask,   ["Edit"],  "ask 独立修改");

  // 删除 allow 中的规则，deny/ask 不受影响
  perms = handleChange(perms, "allow", removeItem(perms.allow, 0));
  assertEqual(perms.allow, [],        "删除 allow 规则");
  assertEqual(perms.deny,  ["Write"], "deny 不受影响");
  assertEqual(perms.ask,   ["Edit"],  "ask 不受影响");
}

console.log("\n── 边界：undefined 字段容错 ──");
{
  // 模拟从文件读取的 perms 可能某个字段缺失
  const perms = {};
  const items = confirmAdd(perms.allow ?? [], "Bash");
  assertEqual(items, ["Bash"], "allow 为 undefined 时能正常新增");

  const after = handleChange(perms, "allow", items);
  assertEqual(after.allow, ["Bash"], "合并后 allow 字段正确");
  assert(after.deny === undefined, "deny 字段未被污染");
}

// ========== 汇总 ==========
console.log(`\n${"─".repeat(36)}`);
console.log(`结果：${passed} 通过，${failed} 失败`);
if (failed > 0) {
  process.exit(1);
}
