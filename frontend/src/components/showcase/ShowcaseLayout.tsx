import React, { useMemo } from 'react';
import { useScrollSpy } from './useScrollSpy';
import './ShowcaseLayout.scss';

export interface SidebarSection {
  id: string;
  title: string;
}

interface ShowcaseLayoutProps {
  sections: SidebarSection[];
  children: React.ReactNode;
}

export default function ShowcaseLayout({ sections, children }: ShowcaseLayoutProps) {
  const ids = useMemo(() => sections.map((s) => s.id), [sections]);
  const active = useScrollSpy(ids);

  const handleClick = (id: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <div className="showcase-layout">
      <aside className="showcase-layout__sidebar">
        <nav className="showcase-layout__nav" aria-label="Секции">
          <ul>
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={`showcase-layout__nav-link ${active === s.id ? 'showcase-layout__nav-link--active' : ''}`}
                  onClick={(e) => handleClick(s.id, e)}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="showcase-layout__main">
        <div className="showcase-layout__hero">
          <h1 className="showcase-layout__title">UI Components</h1>
          <p className="showcase-layout__subtitle">
            Каталог переиспользуемых компонентов проекта. Только для режима разработки.
          </p>
        </div>
        {children}
      </main>
    </div>
  );
}
