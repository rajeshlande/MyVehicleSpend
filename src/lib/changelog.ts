/**
 * Reads CHANGELOG.md (Keep a Changelog format) and checks it against the package version.
 * The app shows this data on the "What's new" screen; the test suite runs the checks.
 */

export const ALLOWED_SECTIONS = [
  'Summary',
  'Added',
  'Changed',
  'Deprecated',
  'Removed',
  'Fixed',
  'Security',
  'Known issues',
  'Upgrade notes',
  'Notes',
] as const;

export interface ChangelogSection {
  title: string;
  items: string[];
}

export interface ChangelogEntry {
  /** "Unreleased" or a SemVer string such as "1.0.0". */
  version: string;
  /** Text after the version in the heading, e.g. "planned for 2026-11-26". */
  note: string | null;
  sections: ChangelogSection[];
}

const VERSION_HEADING = /^## \[([^\]]+)\](?:\s*[—–-]\s*(.+?))?\s*$/;
const SECTION_HEADING = /^### (.+?)\s*$/;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;

function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
}

/** Parses the changelog into entries, newest first, as written in the file. */
export function parseChangelog(source: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let entry: ChangelogEntry | null = null;
  let section: ChangelogSection | null = null;

  for (const line of source.split(/\r?\n/)) {
    const versionMatch = VERSION_HEADING.exec(line);
    if (versionMatch) {
      entry = { version: versionMatch[1] ?? '', note: versionMatch[2] ?? null, sections: [] };
      entries.push(entry);
      section = null;
      continue;
    }
    if (!entry) continue;

    const sectionMatch = SECTION_HEADING.exec(line);
    if (sectionMatch) {
      section = { title: sectionMatch[1] ?? '', items: [] };
      entry.sections.push(section);
      continue;
    }
    if (!section && line.startsWith('- ')) {
      // Bullets straight under a version heading (no section title) go under "Notes".
      section = { title: 'Notes', items: [] };
      entry.sections.push(section);
    }
    if (!section) continue;

    if (line.startsWith('- ')) {
      section.items.push(stripMarkdown(line.slice(2).trim()));
    } else if (/^\s+\S/.test(line) && section.items.length > 0) {
      // Wrapped continuation of the previous bullet.
      const last = section.items.length - 1;
      section.items[last] = `${section.items[last]} ${stripMarkdown(line.trim())}`;
    }
  }
  return entries;
}

function compareSemver(a: string, b: string): number {
  const pa = SEMVER.exec(a);
  const pb = SEMVER.exec(b);
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa?.[i] ?? 0) - Number(pb?.[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Returns a list of problems (empty when the changelog is valid).
 * The package version must be listed, or be a pre-release of a listed version (e.g. "1.0.0-dev").
 */
export function checkChangelog(entries: ChangelogEntry[], packageVersion: string): string[] {
  const errors: string[] = [];
  const first = entries[0];
  if (!first || first.version !== 'Unreleased') {
    errors.push('The first section must be "## [Unreleased]".');
  }

  const released = entries.filter((e) => e.version !== 'Unreleased');
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.version)) errors.push(`Duplicate heading for ${entry.version}.`);
    seen.add(entry.version);

    if (entry.version !== 'Unreleased' && !SEMVER.test(entry.version)) {
      errors.push(`"${entry.version}" is not a SemVer version (MAJOR.MINOR.PATCH).`);
    }
    for (const section of entry.sections) {
      if (!(ALLOWED_SECTIONS as readonly string[]).includes(section.title)) {
        errors.push(`Unknown section "${section.title}" under ${entry.version}.`);
      }
    }
  }

  for (let i = 1; i < released.length; i++) {
    const prev = released[i - 1];
    const cur = released[i];
    if (prev && cur && SEMVER.test(prev.version) && SEMVER.test(cur.version)) {
      if (compareSemver(prev.version, cur.version) <= 0) {
        errors.push(`Versions must be in descending order: ${prev.version} before ${cur.version}.`);
      }
    }
  }

  const base = packageVersion.replace(/-.*$/, '');
  if (!released.some((e) => e.version === packageVersion || e.version === base)) {
    errors.push(`Package version ${packageVersion} has no matching changelog heading.`);
  }
  return errors;
}
