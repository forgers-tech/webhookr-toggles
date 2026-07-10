import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/validate.ts';

test('the committed toggles.yaml passes validation', () => {
  assert.deepEqual(validate(), []);
});
