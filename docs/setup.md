# Instalación y operaciones

## Supabase

El proyecto conectado es `pgosoyxbuxfrkfjvmflm`. Las migraciones en `supabase/migrations` reflejan las versiones aplicadas en el proyecto. No volver a ejecutarlas manualmente sobre el esquema existente.

Para una instalación nueva, usar Supabase CLI autenticado, enlazar el proyecto y aplicar las migraciones. El cron contiene la URL de este proyecto: adaptarla al proyecto de destino antes de instalar.

Las funciones `account-admin` y `price-worker` verifican sus propias credenciales. Se despliegan con `verify_jwt=false`; esto es necesario para el cron y las publishable keys modernas. El worker admite una sesión activa de un miembro para actualizaciones manuales, o el secreto interno de cron. La función de cuentas exige un administrador activo o el token de configuración inicial.

Verificar en Authentication que el registro público esté deshabilitado y la contraseña mínima sea de 8 caracteres. El formulario requiere además una mayúscula y un número. `supabase/config.toml` configura este comportamiento para el entorno local; no confirma la configuración remota. La protección de contraseñas filtradas depende del plan de Supabase; no se contrató ningún servicio pago.

## Primera cuenta e invitaciones

La primera cuenta administradora ya está creada en el proyecto conectado. Su titular debe abrir su enlace privado y elegir una contraseña; la aplicación nunca elige la contraseña.

Para una instalación nueva, el script `npm run admin -- bootstrap correo` necesita `BOOTSTRAP_TOKEN` en el entorno privado. Obtenerlo del secreto `game_journal_setup` de Vault. El comando guarda el enlace en `.bootstrap-link.txt`, excluido de Git. Deja de funcionar una vez que existe un administrador.

Después, Configuración → Invitaciones permite generar enlaces privados de alta o recuperación. Copiar cada enlace solo a su destinatario. No se envían correos ni se configuró SMTP. Los enlaces expiran: generar otro desde la sesión administradora cuando sea necesario.

## Google Sheets

Todavía requiere un proyecto Google Cloud propio:

1. Habilitar Google Picker API y Google Sheets API.
2. Configurar la pantalla de consentimiento y un cliente OAuth de tipo web. Añadir el origen de desarrollo y el origen HTTPS definitivo. Si el consentimiento está en pruebas, añadir las cuentas permitidas.
3. Crear una API key restringida por origen y a las API necesarias.
4. Completar `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_API_KEY` y `NEXT_PUBLIC_GOOGLE_APP_ID` (número de proyecto).

La conexión Google es separada de la sesión del diario. Solicita solo `drive.file` y usa el token temporal para la selección e importación; no lo guarda. La planilla continúa funcionando y no se escribe en ella.

Se leen Tablas, 2025, 2026 y <2025, conservando los valores originales y las escalas. Las filas se identifican por pestaña y título normalizado; títulos repetidos requieren revisión y los renombrados pueden aparecer como altas. No se fusionan automáticamente títulos parecidos ni ediciones distintas. Los enlaces se agregan sin borrar los añadidos manualmente. Los conflictos se resuelven por campo antes de aplicar una transacción. Una ausencia en Sheets no borra datos de la app.

## Precios y notificaciones

Cron activo cada 3 horas a las 02, 05, 08, 11, 14, 17, 20 y 23 de Argentina. Supabase usa UTC; la expresión actual produce esos mismos intervalos por la diferencia de tres horas.

Credenciales internas en Vault:

- `game_journal_cron`: invoca el worker.
- `game_journal_setup`: permite únicamente el primer administrador.
- `game_journal_vapid_public` y `game_journal_vapid_private`: generadas y guardadas por el worker. La clave privada nunca llega al navegador.

Consultar `public.refresh_runs`, `cron.job_run_details` y los logs de Edge Functions para diagnosticar fallos. Cada oferta conserva el último precio válido y muestra por separado la consulta más reciente y el último éxito.

El worker procesa lotes de 8, con dos peticiones simultáneas, lease, caché de 5 minutos y reintentos. La primera consulta establece la referencia y no avisa. Las posteriores generan alertas solo ante una oferta nueva o un precio inferior en la misma moneda, sujeto al objetivo opcional. El push es best effort y elimina endpoints vencidos.

Para Android, publicar mediante HTTPS, abrir la aplicación y activar las notificaciones voluntariamente. El manifiesto incluye iconos de 192 y 512 píxeles. No hay edición offline.

## Publicación

El código está preparado para Vercel, pero todavía no se publicó ni se conectó una cuenta Vercel. Importar el repositorio, configurar las variables públicas y la URL HTTPS definitiva. Añadir ese origen al OAuth Google y a las restricciones de la API key.

La aplicación web no necesita una service role key. Supabase provee esa credencial al entorno de las Edge Functions.

Antes de migrar datos personales, verificar acceso de la cuenta propietaria, importación con Google y exportación. Para recuperar o conservar datos, exportar JSON; CSV sirve para tablas y JSON conserva el modelo completo.

## Límites de esta entrega

No se verificó todavía la importación con la planilla real, el push en un Android real ni el despliegue HTTPS. No se importaron datos personales. Cambios en las tiendas pueden romper el parsing; un error conserva el precio previo. No hay SMTP, conversión de moneda ni cálculo de impuestos.
