/* Fail on process errors AND assertion failures; older suites only print totals. */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const suites = [
  'core', 'negation', 'clin', 'preauth', 'who', 'merge', 'accuracy', 'coder',
  'calc', 'safety', 'extras', 'fhir', 'pilot',
  'calculator-completeness', 'privacy'
];
let failed = 0;
for (const suite of suites) {
  const file = path.join(__dirname, suite + '.js');
  if (!fs.existsSync(file)) {
    console.error(`Missing required suite: ${suite}`);
    failed++;
    continue;
  }
  const result = spawnSync(process.execPath, [file], { cwd: __dirname, encoding: 'utf8' });
  const output = (result.stdout || '') + (result.stderr || '');
  process.stdout.write(`\n── ${suite}\n${output}`);
  if (result.status !== 0 || /\b[1-9]\d* failed\b|\bFAIL\b/.test(output)) failed++;
}
console.log(`\n${suites.length} suites, ${failed} failed`);
process.exitCode = failed ? 1 : 0;