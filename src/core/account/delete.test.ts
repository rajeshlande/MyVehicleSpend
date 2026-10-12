import { describe, it, expect } from 'vitest';
import { isDeleteConfirmed } from './delete';

describe('typed DELETE confirmation (FR-DATA-03)', () => {
  it('accepts the word exactly, ignoring surrounding spaces', () => {
    expect(isDeleteConfirmed('DELETE')).toBe(true);
    expect(isDeleteConfirmed('  DELETE ')).toBe(true);
  });

  it('rejects anything else, including lower case and partial words', () => {
    for (const bad of ['', 'delete', 'DELETE!', 'DELET', 'DELETE ALL', 'DEL ETE']) {
      expect(isDeleteConfirmed(bad)).toBe(false);
    }
  });
});
