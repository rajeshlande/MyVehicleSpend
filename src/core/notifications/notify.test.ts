// T23 — browser notification rules (FR-REM-04; TC-REM-05). Pure.
import { describe, it, expect } from 'vitest';
import { optInState, pickNotifications, pruneSentKeys } from './notify';

describe('optInState — what the Turn on reminders control shows', () => {
  it('no permission decision yet: ask (the prompt is shown only after a tap)', () => {
    expect(optInState({ permission: 'default', preferenceOn: false })).toBe('ask');
  });

  it('granted and the user has it on: on', () => {
    expect(optInState({ permission: 'granted', preferenceOn: true })).toBe('on');
  });

  it('granted but the user turned it off: off (can be turned back on without a prompt)', () => {
    expect(optInState({ permission: 'granted', preferenceOn: false })).toBe('off');
  });

  it('declined: blocked, and the app still works', () => {
    expect(optInState({ permission: 'denied', preferenceOn: true })).toBe('blocked');
  });

  it('browser has no notification API: unsupported', () => {
    expect(optInState({ permission: 'unsupported', preferenceOn: true })).toBe('unsupported');
  });
});

describe('pickNotifications — overdue and due-soon items, once per item per day', () => {
  const items = [
    { id: 'a', title: 'PUC certificate', status: 'overdue' as const },
    { id: 'b', title: 'Car insurance', status: 'due_soon' as const },
    { id: 'c', title: 'Service', status: 'upcoming' as const },
    { id: 'd', title: 'Old', status: 'done' as const },
  ];

  it('notifies overdue and due-soon items only', () => {
    const out = pickNotifications(items, '2026-10-12', new Set());
    expect(out.map((n) => n.id)).toEqual(['a', 'b']);
    expect(out[0]).toMatchObject({ title: 'PUC certificate', body: 'Overdue' });
    expect(out[1]).toMatchObject({ title: 'Car insurance', body: 'Due soon' });
  });

  it('does not repeat an item it has already shown today', () => {
    const sent = new Set(['a:2026-10-12']);
    expect(pickNotifications(items, '2026-10-12', sent).map((n) => n.id)).toEqual(['b']);
  });

  it('shows it again on a new day', () => {
    const sent = new Set(['a:2026-10-12']);
    expect(pickNotifications(items, '2026-10-13', sent).map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('pruneSentKeys — keep only today’s keys, so storage does not grow', () => {
  it('drops keys from earlier days', () => {
    expect(pruneSentKeys(['a:2026-10-11', 'b:2026-10-12'], '2026-10-12')).toEqual(['b:2026-10-12']);
  });
});
