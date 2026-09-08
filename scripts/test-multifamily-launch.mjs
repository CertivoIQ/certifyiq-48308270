import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function moduleAt(path, require = () => { throw new Error('Unexpected dependency'); }) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, require });
  return exports;
}
const access = moduleAt('src/lib/internal-segment-access.ts');
test('printable and email marketing use only the public Multifamily catalog', () => {
  const catalog = moduleAt('src/lib/platform-data.ts');
  assert.equal(catalog.PUBLIC_PLANS.length, 1);
  assert.equal(catalog.PUBLIC_PLANS[0].id, 'multifamily_enterprise');
  assert.ok(catalog.PLANS.some(plan=>plan.id==='pha'));
  for (const path of ['src/routes/_authenticated/marketing-kit.tsx','src/lib/email-templates/intro-cold.tsx']) assert.match(readFileSync(path,'utf8'),/PUBLIC_PLANS as PLANS/);
  assert.doesNotMatch(readFileSync('src/lib/email-templates/i18n.ts','utf8'),/PHA.*150,000/);
});
test('internal access requires an exact verified company identity', () => {
  const user = { id: 'u', email: 'Tester@CertivoIQ.com', email_confirmed_at: '2026-09-08' };
  assert.equal(access.isInternalSegmentUser(user), true);
  for (const email of ['customer@example.com', 'a@certivoiq.com.example.org', 'a@@certivoiq.com', ' a@certivoiq.com', 'a@sub.certivoiq.com']) assert.equal(access.isInternalSegmentUser({ ...user, email }), false);
  assert.equal(access.isInternalSegmentUser({ ...user, email_confirmed_at: undefined }), false);
  assert.equal(access.isInternalSegmentUser({ ...user, is_anonymous: true }), false);
  assert.equal(access.isInternalSegmentUser(null), false);
});
test('direct internal routes and historical checkout selections are guarded', () => {
  for (const path of ['/pha', '/pha/director', '/pha-dashboard', '/nspire', '/nspire/inspection', '/crm-pha-controls']) assert.equal(access.isInternalSegmentPath(path), true);
  for (const path of ['/dashboard', '/pricing', '/billing']) assert.equal(access.isInternalSegmentPath(path), false);
  assert.doesNotThrow(() => access.assertPublicLicenseKind('multifamily_enterprise'));
  for (const kind of ['pha', 'professional', 'business', '', 'enterprise']) assert.throws(() => access.assertPublicLicenseKind(kind));
});
test('customer training excludes internal material while preserving internal lessons', () => {
  const lessons = JSON.parse(readFileSync('src/lib/training/lessons.json', 'utf8'));
  const catalog = moduleAt('src/lib/training/catalog.ts', () => lessons);
  const external = catalog.filterTrainingLessons(true);
  assert.ok(external.length > 0);
  assert.doesNotMatch(JSON.stringify(external), /\bPHA\b|NSPIRE|HUD-50058/i);
  const internal = catalog.filterTrainingLessons(true, '', 'all', 'all', true);
  assert.equal(internal.length, lessons.length);
});
