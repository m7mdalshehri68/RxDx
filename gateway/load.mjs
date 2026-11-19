/* Test-only: load worker.js with its helpers exported, without changing the
   file that is deployed (Cloudflare wants one default export and nothing else). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'worker.js'), 'utf8')
  + '\nexport { deid, readAnswer, SCHEMA, SYSTEM, userMessage };\n';
export default await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
