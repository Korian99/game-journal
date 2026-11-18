const sections = [
  { id: "games", href: "/?tab=library", label: "Biblioteca" },
  { id: "series", href: "/?tab=library&section=series", label: "Series" },
  { id: "history", href: "/?tab=journal", label: "Histórico" },
] as const;

type Section = (typeof sections)[number]["id"];

export function LibrarySectionNav({
  current,
  onNavigate,
}: {
  current: Section;
  onNavigate: (section: Section) => void;
}) {
  return (
    <nav className="library-section-nav" aria-label="Secciones de Biblioteca">
      {sections.map(({ id, href, label }) => (
        <a
          key={id}
          href={href}
          aria-current={id === current ? "page" : undefined}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
              return;
            event.preventDefault();
            onNavigate(id);
          }}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
