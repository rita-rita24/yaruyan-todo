import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'espree';
const html = readFileSync('performance/round5/baseline.html', 'utf8');
const start = html.indexOf('<script>') + '<script>'.length;
const end = html.indexOf('</script>', start);
const source = html.slice(start, end);
const ast = parse(source, { ecmaVersion: 2026, range: true });
const edits = [];
function visit(node, selected = false) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration')
    selected = ['createSubtaskRowMarkup', 'renderTasks'].includes(node.id.name);
  if (selected && node.type === 'TemplateElement') {
    const raw = node.value.raw;
    const compact = raw.replace(/\n[ \t]*/g, ' ').replace(/> +</g, '><');
    if (compact !== raw) {
      const offset = node.range[0] + 1;
      if (source.slice(offset, offset + raw.length) !== raw)
        throw Error('Template range mismatch');
      edits.push({ start: offset, end: offset + raw.length, compact });
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'range') continue;
    if (Array.isArray(value)) value.forEach((child) => visit(child, selected));
    else if (value && typeof value === 'object') visit(value, selected);
  }
}
visit(ast);
let candidate = source;
for (const edit of edits.sort((a, b) => b.start - a.start))
  candidate =
    candidate.slice(0, edit.start) + edit.compact + candidate.slice(edit.end);
writeFileSync(
  'performance/round5/candidate.html',
  html.slice(0, start) + candidate + html.slice(end),
);
console.log(
  JSON.stringify({
    templateSegments: edits.length,
    removedBytes: source.length - candidate.length,
  }),
);
