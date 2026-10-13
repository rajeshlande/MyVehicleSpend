import changelogSource from '../../../CHANGELOG.md?raw';
import { parseChangelog } from '../../lib/changelog';

// Parsed once at load. CHANGELOG.md is the single source for this screen.
const entries = parseChangelog(changelogSource);

export function WhatsNewPage() {
  return (
    <>
      <h1>What&apos;s new</h1>
      <p>Version {__APP_VERSION__}</p>
      {entries.map((entry, i) => {
        const titleId = `release-${i}`;
        const label = entry.version === 'Unreleased' ? 'Unreleased' : `Version ${entry.version}`;
        return (
          <section key={entry.version} aria-labelledby={titleId} className="release">
            <h2 id={titleId}>
              {label}
              {entry.note && <span className="hint"> — {entry.note}</span>}
            </h2>
            {entry.sections.map((section) => (
              <div key={section.title}>
                <h3>{section.title}</h3>
                <ul>
                  {section.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}
