import type { Metadata } from "next";
import styles from "./public.module.css";

export const metadata: Metadata = {
  title: { default: "Game Journal", template: "%s · Game Journal" },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.brand} href="/about" aria-label="Game Journal, inicio">
          <span className={styles.mark} aria-hidden="true">gj.</span>
          <span>Game Journal</span>
        </a>
        <nav className={styles.nav} aria-label="Navegación principal">
          <a href="/about">Acerca de</a>
          <a href="/privacy">Privacidad</a>
          <a href="/terms">Términos</a>
          <a className={styles.signIn} href="/login">Ingresar <span aria-hidden="true">↗</span></a>
        </nav>
      </header>
      <main id="contenido" className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <a className={styles.footerBrand} href="/about">gj. <span>Game Journal</span></a>
        <nav aria-label="Enlaces del pie de página">
          <a href="/about">Acerca de</a>
          <a href="/privacy">Privacidad</a>
          <a href="/terms">Términos</a>
          <a href="mailto:mateoisrailev@gmail.com">Contacto</a>
        </nav>
        <a className={styles.email} href="mailto:mateoisrailev@gmail.com">mateoisrailev@gmail.com</a>
      </footer>
    </div>
  );
}
