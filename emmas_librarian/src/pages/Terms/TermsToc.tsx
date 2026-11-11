import React, { useEffect, useState } from 'react';
import { TERMS_SECTIONS } from './termsContent';

/**
 * The id of the last section whose top has passed the reading line, or the first one.
 *
 * @example sectionAtScroll((id) => (id === 'local-first' ? -300 : 900), 160) // 'local-first'
 */
export function sectionAtScroll(topOf: (id: string) => number | undefined, line: number): string {
  let current = TERMS_SECTIONS[0].id;
  for (const { id } of TERMS_SECTIONS) {
    const top = topOf(id);
    if (top !== undefined && top <= line) current = id;
  }
  return current;
}

/** Which section is being read, following the scroll of the page's main area. */
function useActiveSection(): [string, (id: string) => void] {
  const [active, setActive] = useState(TERMS_SECTIONS[0].id);
  useEffect(() => {
    const scroller = document.querySelector('main') ?? window;
    const onScroll = () =>
      setActive(sectionAtScroll((id) => document.getElementById(id)?.getBoundingClientRect().top, 160));
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);
  return [active, setActive];
}

/**
 * "Nesta página" (board 174): the sections of the terms as links that scroll to them, the one being read marked.
 *
 * @example <TermsToc />
 */
export const TermsToc: React.FC = () => {
  const [active, setActive] = useActiveSection();
  return (
    <nav className="terms-toc" aria-label="Nesta página">
      <span className="terms-toc__title">Nesta página</span>
      {TERMS_SECTIONS.map(({ id, tocLabel }) => (
        <a
          key={id}
          href={`#${id}`}
          className={id === active ? 'is-active' : undefined}
          aria-current={id === active ? 'location' : undefined}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActive(id);
          }}
        >
          {tocLabel}
        </a>
      ))}
    </nav>
  );
};
