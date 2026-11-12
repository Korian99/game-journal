import type { Metadata } from "next";
import styles from "../public.module.css";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Cómo Game Journal trata tus datos y los datos de Google.",
};

export default function PrivacyPage() {
  return (
    <article className={styles.article}>
      <p className={styles.eyebrow}>Transparencia</p>
      <h1>Privacidad</h1>
      <p className={styles.intro}>Qué información usa Game Journal y qué opciones tenés para controlarla.</p>
      <p className={styles.meta}>Última actualización: 12 de noviembre de 2026</p>
      <div className={styles.articleBody}>
        <aside className={styles.warning}>
          <strong>Proyecto personal experimental.</strong>
          <p>
            Se ofrece en su estado actual. Puede cambiar o interrumpirse; los
            datos podrían perderse o quedar expuestos en un incidente. Las copias
            son experimentales y no se garantiza su recuperación. Consultá los
            <a href="/terms"> términos de uso</a> y guardá exportaciones propias.
          </p>
        </aside>
        <h2>Información que usamos</h2>
        <p>
          Para operar tu cuenta usamos el correo electrónico, el nombre de
          perfil y los datos necesarios para mantener la sesión. Tu biblioteca
          puede incluir historial de juegos, notas privadas, reseñas y
          preferencias que agregues.
        </p>
        <h2>Planillas que elegís importar</h2>
        <p>
          Si elegís importar desde Google Sheets, la aplicación solicita acceso
          solo a las planillas que seleccionás mediante el selector de Google.
          Leemos la planilla para importar su contenido a tu diario; no
          modificamos el archivo original. El contenido importado pasa a formar
          parte de los datos de tu cuenta.
        </p>
        <h2>Copias opcionales en Google Drive</h2>
        <p>
          Si conectás Drive, Game Journal usa el permiso <code>drive.file</code>{" "}
          para crear y actualizar archivos propios de la aplicación en una
          carpeta de copias. Esto incluye archivos JSON y Excel y un manifiesto.
          No permite explorar todo tu Drive ni alterar la planilla original.
        </p>
        <p>
          Los tokens de actualización de Google se guardan cifrados en Supabase
          Vault y no se exponen al navegador ni se incluyen en los archivos de
          copia. Las entradas eliminadas permanecen en la papelera hasta 30
          días. La configuración actual mantiene las 30 copias internas
          exitosas más recientes. En Drive intenta conservar las 30 copias
          diarias más recientes y la primera copia exitosa de cada uno de los
          últimos 12 meses. Las copias pueden conservar entradas eliminadas
          hasta que roten. Estos mecanismos pueden fallar; las copias externas
          también dependen del servicio y los permisos de Google.
        </p>
        <h2>Proveedores y uso</h2>
        <p>
          Game Journal utiliza Vercel para alojar la aplicación, Supabase para
          la base de datos y la autenticación, y Google Drive cuando activás esa
          opción. También consulta páginas de Steam y Nintendo para mostrar
          información de juegos seleccionados, como precios o fechas, que puede
          cambiar con el tiempo.
        </p>
        <p>
          Podés compartir información mediante las funciones de la aplicación.
          El acceso del operador al contenido se limita a soporte que solicites
          y a tareas de seguridad y mantenimiento. La aplicación no integra
          funciones de publicidad, analítica ni entrenamiento de modelos de
          inteligencia artificial, y no está configurada para vender tus datos.
          Los proveedores de alojamiento y operación pueden procesar registros
          técnicos o de seguridad, como dirección IP, dispositivo o solicitudes.
        </p>
        <h2>Sesión y cookies</h2>
        <p>
          Se usan cookies necesarias para mantener la autenticación y la sesión.
          No se integran cookies publicitarias ni herramientas de analítica.
        </p>
        <h2>Desconectar Google y gestionar tus datos</h2>
        <p>
          Podés desconectar Drive desde la aplicación o revocar el acceso en{" "}
          <a href="https://myaccount.google.com/connections">tu cuenta de Google</a>.
          Desconectar detiene futuras copias, pero no elimina archivos que ya
          estén en Drive; podés borrarlos desde allí. Las entradas eliminadas
          pueden permanecer en copias hasta que roten.
        </p>
        <p>
          Para solicitar una copia o la eliminación de los datos de tu cuenta,
          escribí a <a href="mailto:mateoisrailev@gmail.com">mateoisrailev@gmail.com</a>.
          No hay una función de eliminación de cuenta autoservicio.
        </p>
        <h2>Datos de Google</h2>
        <p>
          El acceso y uso de datos de Google está sujeto a la <a href="https://developers.google.com/terms/api-services-user-data-policy">Política de datos de usuario de los servicios de API de Google</a>,
          que incluye requisitos de uso limitado. En esta aplicación, esos datos
          se usan para las funciones visibles de importación y copias que elegís.
        </p>
        <p>Consultas de privacidad: <a href="mailto:mateoisrailev@gmail.com">mateoisrailev@gmail.com</a>.</p>
      </div>
    </article>
  );
}
