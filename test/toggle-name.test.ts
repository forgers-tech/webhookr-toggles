import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finalName, isService, isValidToggleName } from '../src/lib/toggle-name.ts';

test('finalName builds the webhookr.<service>.<name> convention', () => {
  assert.equal(finalName('svc', 'processor-engine'), 'webhookr.svc.processor-engine');
});

test('isService accepts canonical services and rejects others', () => {
  for (const service of ['web', 'bff', 'svc', 'ingest']) {
    assert.equal(isService(service), true);
  }
  assert.equal(isService('api'), false);
  assert.equal(isService('SVC'), false);
});

test('isValidToggleName enforces lowercase kebab-case', () => {
  assert.equal(isValidToggleName('new-dashboard'), true);
  assert.equal(isValidToggleName('processor-config-write'), true);
  assert.equal(isValidToggleName('a1'), true);
  assert.equal(isValidToggleName('New-Dashboard'), false);
  assert.equal(isValidToggleName('-leading'), false);
  assert.equal(isValidToggleName('trailing-'), false);
  assert.equal(isValidToggleName('double--dash'), false);
  assert.equal(isValidToggleName('under_score'), false);
});
