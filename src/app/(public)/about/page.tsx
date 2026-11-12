import type { Metadata } from "next";
import styles from "../public.module.css";

export const metadata: Metadata = {
  title: "Acerca de",
  description: "Un espacio personal para recordar lo que jugás.",
};

export default function AboutPage() {
  return (
    <article className={styles.article}>
      <p className={styles.eyebrow}>Tu historia jugando</p>
      <h1>Un lugar para volver a tus partidas.</h1>
      <p className={styles.intro}>
        Game Journal reúne tus juegos, tus notas y los recuerdos que nacen en el camino.
      </p>
      <div className={styles.articleBody}>
        <p className={styles.notice}>
          Es un proyecto personal experimental para quien lo mantiene y sus
          amistades invitadas. Las copias son experimentales; consultá los{" "}
          <a href="/terms">términos de uso</a>.
        </p>
        <p>
          Llevá una biblioteca de juegos, registrá tus partidas y escribí reseñas
          privadas. También podés guardar una lista de deseos y seguir los
          próximos lanzamientos.
        </p>
        <p>
          Podés importar datos desde una planilla que elijas para completar tu
          diario. De forma opcional, podés conectar Google Drive para crear
          copias de tus datos.
        </p>
        <h2>Acceso por invitación</h2>
        <p>
          Game Journal es una aplicación personal disponible para personas
          invitadas. Si ya tenés acceso, podés ingresar con tu cuenta.
        </p>
        <div className={styles.actions}>
          <a className={styles.action} href="/login">Ingresar <span aria-hidden="true">↗</span></a>
          <a className={styles.action} href="/privacy">Leer sobre privacidad</a>
          <a className={styles.action} href="mailto:mateoisrailev@gmail.com">Escribir por correo</a>
        </div>
      </div>
    </article>
  );
}
