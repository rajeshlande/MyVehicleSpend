import { describe, it, expect } from 'vitest';
import changelogSource from '../../CHANGELOG.md?raw';
import pkg from '../../package.json';
import { parseChangelog, checkChangelog } from './changelog';

const SAMPLE = `# Changelog

## [Unreleased]

### Added

- Thing one.
- Thing two with a
  wrapped line.

## [1.0.0] — planned for 2026-11-26

### Summary

First release.

### Fixed

- **Bold** fix.
`;

describe('parseChangelog', () => {
  it('reads version, note, sections and wrapped bullet items', () => {
    const entries = parseChangelog(SAMPLE);
    expect(entries.map((e) => e.version)).toEqual(['Unreleased', '1.0.0']);
    expect(entries[1]?.note).toBe('planned for 2026-11-26');
    expect(entries[0]?.sections).toEqual([
      { title: 'Added', items: ['Thing one.', 'Thing two with a wrapped line.'] },
    ]);
    expect(entries[1]?.sections[1]).toEqual({ title: 'Fixed', items: ['Bold fix.'] });
  });

  it('groups bullets that sit directly under a version heading as Notes', () => {
    const entries = parseChangelog('## [0.1.0] — internal\n\n- Walking skeleton.\n');
    expect(entries[0]?.sections).toEqual([{ title: 'Notes', items: ['Walking skeleton.'] }]);
  });

  it('ignores text before the first version heading', () => {
    expect(parseChangelog('# Title\n\nintro text\n')).toEqual([]);
  });
});

describe('checkChangelog', () => {
  const entry = (version: string, sections: { title: string; items: string[] }[] = []) => ({
    version,
    note: null,
    sections,
  });

  it('accepts the bundled CHANGELOG.md against the package version', () => {
    expect(checkChangelog(parseChangelog(changelogSource), pkg.version)).toEqual([]);
  });

  it('requires an Unreleased section at the top', () => {
    const errors = checkChangelog([entry('1.0.0')], '1.0.0');
    expect(errors.join(' ')).toMatch(/Unreleased/);
  });

  it('rejects versions that are not SemVer', () => {
    const errors = checkChangelog([entry('Unreleased'), entry('v2')], '1.0.0');
    expect(errors.join(' ')).toMatch(/SemVer/);
  });

  it('rejects versions out of descending order', () => {
    const errors = checkChangelog([entry('Unreleased'), entry('1.0.0'), entry('1.1.0')], '1.1.0');
    expect(errors.join(' ')).toMatch(/order/);
  });

  it('rejects duplicate version headings', () => {
    const errors = checkChangelog([entry('Unreleased'), entry('1.0.0'), entry('1.0.0')], '1.0.0');
    expect(errors.join(' ')).toMatch(/duplicate/i);
  });

  it('rejects unknown section titles', () => {
    const errors = checkChangelog(
      [entry('Unreleased', [{ title: 'Misc', items: ['x'] }])],
      '1.0.0'
    );
    expect(errors.join(' ')).toMatch(/Misc/);
  });

  it('requires the package version to be listed, allowing a -dev pre-release of a listed version', () => {
    expect(checkChangelog([entry('Unreleased'), entry('1.0.0')], '1.0.0-dev')).toEqual([]);
    expect(checkChangelog([entry('Unreleased'), entry('1.0.0')], '2.0.0')).not.toEqual([]);
  });
});
