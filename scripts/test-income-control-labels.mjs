import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('src/components/income-calculator.tsx','utf8');
test('calculator text and date inputs keep an explicit name independent of hint text',()=>{
  const field=source.slice(source.indexOf('function Field('),source.indexOf('function Choose('));
  assert.match(field,/<input aria-label=\{title\}/);
  assert.match(field,/<label/);
});
test('calculator dropdown name does not include option contents',()=>{
  const choose=source.slice(source.indexOf('function Choose('),source.indexOf('function Check('));
  assert.match(choose,/<select aria-label=\{title\}/);
  assert.match(choose,/<label/);
});
