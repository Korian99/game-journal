import { LoginForm } from "@/components/login-form";
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
        <LoginForm />
      </section>
    </main>
  );
}
