import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';

// Execute the real handlers with only framework/auth transport replaced.
const original = readFileSync(new URL('../src/utils/mfa.functions.ts', import.meta.url), 'utf8');
const source = stripTypeScriptTypes(original)
  .replace(/^import .*;\r?\n/gm, '')
  .replaceAll('export const ', 'const ')
  .replaceAll('await import("@/integrations/supabase/client.server")', '({ supabaseAdmin: admin })');
function handlers(admin) {
  const createServerFn = () => ({ middleware() { return this; }, inputValidator() { return this; }, handler(fn) { return fn; } });
  return new Function('admin', 'createServerFn', 'requireSupabaseAuth', 'createHash', 'randomBytes',
    source + '\nreturn { generateRecoveryCodes, verifyAndDisableRecoveryCode };')
    (admin, createServerFn, {}, createHash, randomBytes);
}
const context = (aal) => ({ userId: 'owner', claims: { aal } });

test('password-only and ambiguous claims cannot mint recovery credentials', async () => {
  const admin = { from() { assert.fail('Privileged storage must not be touched'); } };
  for (const aal of ['aal1', undefined, null, '', 'AAL2']) {
    await assert.rejects(handlers(admin).generateRecoveryCodes({ context: context(aal) }), /Verify your authenticator/);
  }
});

test('verified MFA generates owner-bound hashes, never plaintext storage', async () => {
  let rows;
  const admin = { from(table) {
    assert.equal(table, 'user_recovery_codes');
    return { delete: () => ({ eq: (key, owner) => { assert.equal(owner, 'owner'); return { is: async () => ({ error: null }) }; } }),
      insert: async (value) => { rows = value; return { error: null }; } };
  } };
  const { codes } = await handlers(admin).generateRecoveryCodes({ context: context('aal2') });
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (let i = 0; i < codes.length; i++) {
    assert.match(codes[i], /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.deepEqual(rows[i], { user_id: 'owner', code_hash: createHash('sha256').update(codes[i]).digest('hex') });
  }
});

function recoveryAdmin({ claimFailure = false, factorFailure = false } = {}) {
  let spent = false, deletes = 0, claims = 0;
  const admin = {
    from() { return {
      select() { return { eq() { return this; }, limit: async () => ({ data: [{ id: 'code', used_at: null }], error: null }) }; },
      update(values) { assert.ok(values.used_at); const predicates = {};
        return { eq(k, v) { predicates[k] = v; return this; }, is(k, v) { predicates[k] = v; return this; }, select() { return this; },
          async maybeSingle() {
            assert.deepEqual(predicates, { id: 'code', user_id: 'owner', used_at: null });
            claims++;
            if (claimFailure) return { data: null, error: new Error('unavailable') };
            if (spent) return { data: null, error: null };
            spent = true; return { data: { id: 'code' }, error: null };
          } };
      } }; },
    auth: { admin: { mfa: {
      async listFactors() { assert.equal(spent, true); return { data: { factors: [{ id: 'factor' }] }, error: factorFailure ? new Error('unavailable') : null }; },
      async deleteFactor({ userId }) { assert.equal(spent, true); assert.equal(userId, 'owner'); deletes++; return { error: null }; },
    } } },
  };
  return { admin, state: () => ({ spent, deletes, claims }) };
}
const request = { context: context('aal1'), data: { code: 'ABCD-EFGH-JKLM' } };
test('concurrent recovery attempts allow exactly one factor-removal operation', async () => {
  const fixture = recoveryAdmin(); const h = handlers(fixture.admin);
  const results = await Promise.all([h.verifyAndDisableRecoveryCode(request), h.verifyAndDisableRecoveryCode(request)]);
  assert.equal(results.filter(r => r.ok).length, 1);
  assert.equal(results.filter(r => r.error).length, 1);
  assert.deepEqual(fixture.state(), { spent: true, deletes: 1, claims: 2 });
});
test('a failed claim never reaches factor deletion', async () => {
  const fixture = recoveryAdmin({ claimFailure: true });
  assert.ok((await handlers(fixture.admin).verifyAndDisableRecoveryCode(request)).error);
  assert.equal(fixture.state().deletes, 0);
});
test('a downstream error leaves the recovery code spent and rejects replay', async () => {
  const fixture = recoveryAdmin({ factorFailure: true }); const h = handlers(fixture.admin);
  assert.ok((await h.verifyAndDisableRecoveryCode(request)).error);
  assert.ok((await h.verifyAndDisableRecoveryCode(request)).error);
  assert.deepEqual(fixture.state(), { spent: true, deletes: 0, claims: 2 });
});
