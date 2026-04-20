import { useEffect, useState } from 'react';

export function useScrollSpy(sectionIds: string[], offset = 120): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (sectionIds.length === 0) return undefined;

    const handler = () => {
      const scroll = window.scrollY + offset;
      let current: string | null = null;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.offsetTop;
        if (scroll >= top) {
          current = id;
        } else {
          break;
        }
      }
      setActive(current ?? sectionIds[0]);
    };

    handler();
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, [sectionIds, offset]);

  return active;
}
