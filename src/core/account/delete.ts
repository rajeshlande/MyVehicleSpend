/** Typed confirmation for account deletion (FR-DATA-03). The user must type this word exactly. */
export const DELETE_CONFIRM_WORD = 'DELETE';

export function isDeleteConfirmed(typed: string): boolean {
  return typed.trim() === DELETE_CONFIRM_WORD;
}
