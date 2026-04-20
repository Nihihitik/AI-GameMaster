import React from 'react';
import './ShowcaseSection.scss';

interface ShowcaseSectionProps {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export default function ShowcaseSection({
  id,
  title,
  description,
  children,
}: ShowcaseSectionProps) {
  return (
    <section className="showcase-section" id={id}>
      <header className="showcase-section__head">
        <h2 className="showcase-section__title">{title}</h2>
        {description && <p className="showcase-section__desc">{description}</p>}
      </header>
      <div className="showcase-section__items">{children}</div>
    </section>
  );
}
