import { LoginForm } from "@/components/login-form";
export default function Login() {
  return (
    <main className="login-page">
      <section className="login-story">
        <a className="brand" href="/">
          <span className="brand-icon">gj.</span>
          <span>
            game journal<span className="brand-sub">TU HISTORIA JUGANDO</span>
          </span>
        </a>
        <div>
          <span className="eyebrow">GUARDÁ ALGO MÁS QUE LA PARTIDA</span>
          <h1>
            Tu próxima partida
            <br />
            empieza acá.
          </h1>
          <p>
            Los juegos que te marcaron.
            <br />
            Los que todavía te esperan.
            <br />
            Todo en un mismo lugar.
          </p>
          <div className="orbit">
            <span>▶</span>
            <i />
            <b>CONTINUE?</b>
          </div>
        </div>
        <small>Un diario personal. Una partida a la vez.</small>
      </section>
      <section className="login-side">
        <LoginForm />
      </section>
    </main>
  );
}
