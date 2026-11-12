import type { Metadata } from "next";
import styles from "../public.module.css";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Condiciones sencillas para usar Game Journal.",
};

export default function TermsPage() {
  return (
    <article className={styles.article}>
      <p className={styles.eyebrow}>Uso del servicio</p>
      <h1>Términos de uso</h1>
      <p className={styles.intro}>Un proyecto personal experimental para quien lo mantiene y sus amistades invitadas.</p>
      <p className={styles.meta}>Última actualización: 12 de noviembre de 2026</p>
      <div className={styles.articleBody}>
        <h2>Un servicio personal por invitación</h2>
        <p>
          Game Journal sirve para llevar un registro de juegos y se ofrece en
          su estado actual. Puede cambiar, interrumpirse o dejar de estar
          disponible de forma permanente; el operador no se compromete a
          mantenerlo indefinidamente.
        </p>
        <p>Conservá exportaciones independientes por si el proyecto deja de estar disponible.</p>
        <aside className={styles.warning}>
          <strong>Copias experimentales: usalas bajo tu responsabilidad.</strong>
          <p>
            Una copia puede fallar, llegar tarde, quedar incompleta,
            corromperse o perderse. No se garantiza disponibilidad, continuidad,
            integridad, confidencialidad absoluta, conservación por un plazo determinado,
            éxito de una restauración ni soporte. Guardá exportaciones
            independientes en otro lugar y evitá incluir información sensible o
            irremplazable.
          </p>
        </aside>
        <h2>Tu cuenta y tu contenido</h2>
        <p>
          Cuidá las credenciales de tu cuenta. El contenido que agregás, como notas,
          preferencias, reseñas y registros de partidas, sigue siendo tuyo.
          Asegurate de tener derecho a importar cualquier información o planilla
          que selecciones.
        </p>
        <h2>Información de juegos</h2>
        <p>
          Los precios, fechas de lanzamiento y otros datos obtenidos de páginas
          de Steam o Nintendo son orientativos y pueden cambiar.
        </p>
        <h2>Cambios y consultas</h2>
        <p>
          Las funciones del servicio pueden cambiar. Para corregir información,
          solicitar una exportación o pedir la eliminación de datos de tu cuenta,
          escribí a <a href="mailto:mateoisrailev@gmail.com">mateoisrailev@gmail.com</a>.
        </p>
        <p>
          El tratamiento de datos se explica en la <a href="/privacy">Política de privacidad</a>.
        </p>
        <p>Este aviso no elimina los derechos ni las obligaciones que la ley no permite excluir.</p>
      </div>
    </article>
  );
}
