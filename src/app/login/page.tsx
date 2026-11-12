import { LoginForm } from "@/features/auth/login-form";
import styles from "../(public)/public.module.css";
export default function Login() {
  return (
    <main className="login-page">
      <section className="login-story">
        <a className="brand" href="/">
          <span className="brand-icon">gj.</span>
          <span>Game Journal</span>
        </a>
        <div>
          <h1>Tus juegos.</h1>
        </div>
      </section>
      <section className="login-side">
        <div className={styles.loginContent}>
          <LoginForm />
          <nav aria-label="Información" className={styles.loginLinks}>
            <a href="/about">Acerca de</a>
            <a href="/privacy">Privacidad</a>
            <a href="/terms">Términos</a>
          </nav>
        </div>
      </section>
    </main>
  );
}
