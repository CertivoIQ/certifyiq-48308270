// One-time transport of the reviewed local source bundle; removed after integration.
import { brotliDecompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const repository = 'Watkin5/certifyiq-48308270';
if (process.env.GITHUB_REPOSITORY !== repository || process.env.GITHUB_REF_NAME !== 'feat/native-income-calculator') throw new Error('Unexpected integration target');
const chunks = [];
for (const sha of ['b88fbbecb4081f0518a738d63e07a4f0f142fc7f', '3b52ff794f63f07738249f1eb14a773423e01d46']) {
  const r = await fetch(`https://api.github.com/repos/${repository}/git/blobs/${sha}`, {headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'}});
  if (!r.ok) throw new Error(`Source blob unavailable: ${r.status}`);
  const blob = await r.json();
  if (blob.encoding !== 'base64') throw new Error('Unexpected blob encoding');
  chunks.push(Buffer.from(blob.content, 'base64'));
}
const bytes = Buffer.concat(chunks);
if (createHash('sha256').update(bytes).digest('hex') !== '74379bfc17cfeb0bd3dd52ed769383dacdcb0c283a22eeabdc12242aa6a7dd3c') throw new Error('Source bundle integrity mismatch');
const sources = JSON.parse(brotliDecompressSync(bytes).toString('utf8'));
const allowed = ['docs/native-income-calculator.md','scripts/test-native-income-calculator.mjs','src/components/income-calculator.tsx','src/routes/_authenticated/income-calculator.tsx','supabase/functions/_shared/income-calculator-engine.ts','supabase/functions/income-calculator/deno.json','supabase/functions/income-calculator/index.ts','supabase/migrations/20260906025632_native_income_calculator_immutable_records.sql'];
if (Object.keys(sources).sort().join('\n') !== [...allowed].sort().join('\n')) throw new Error('Unexpected source paths');
for (const [path, content] of Object.entries(sources)) { if (typeof content !== 'string') throw new Error('Invalid source content'); mkdirSync(dirname(path),{recursive:true}); writeFileSync(path,content); console.log(`Installed ${path}`); }
const path = 'src/components/app-shell.tsx';
let shell = readFileSync(path,'utf8');
if (!shell.includes('  Calculator,\n')) shell = shell.replace('  Building2,\n','  Building2,\n  Calculator,\n');
for (const [name, extra] of [['MF_COMMAND',''],['PHA_COMMAND',', key: "family_read"']]) {
  const rx = new RegExp(`(const ${name}:[^\\n]+\\[\\n)([\\s\\S]*?)(\\n\\];)`);
  if (!rx.test(shell)) throw new Error(`Navigation section missing: ${name}`);
  shell = shell.replace(rx, (match, start, body, end) => body.includes('/income-calculator') ? match : `${start}  { to: "/income-calculator", label: "Income Calculator", icon: Calculator${extra} },\n${body}${end}`);
}
if ((shell.match(/label: "Income Calculator"/g)||[]).length !== 2) throw new Error('Expected both Multifamily and PHA menu entries');
writeFileSync(path,shell);
console.log('Both desktop/mobile shared navigation groups include Income Calculator.');
