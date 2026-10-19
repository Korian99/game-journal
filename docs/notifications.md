
# Notificaciones

## Uso en el teléfono

Después de desplegar la web, abrir la app instalada → Configuración → Notificaciones → **Activar en este dispositivo**, aceptar el permiso y pulsar **Enviar prueba**. Instalar la app no crea una suscripción push automáticamente. Las preferencias se sincronizan por cuenta; la activación/desactivación es por dispositivo.

- **Descuentos nuevos:** páginas seguidas de juegos en Deseos o Próximos. Solo un descuento que empieza o mejora de precio; el primer precio guardado establece la referencia y no avisa de ofertas antiguas.
- **Por debajo de Objetivo:** usa el Objetivo de Páginas en su moneda original, con comparación estricta precio < objetivo. Si ambas opciones están activadas, el aviso de objetivo reemplaza al aviso general para ese mismo cambio. Una oferta igual al objetivo todavía puede dar un aviso general si esa opción está activada.
- **Nuevos lanzamientos:** fechas exactas registradas, también desde los datos originales de Sheets, o Steam pasando de próximo a disponible/early access/free. No se inventa un día para temporadas/años ni se mueve el juego de Próximos. Un aviso por juego. Se omiten fechas anteriores al día de activación para no enviar lanzamientos viejos.
- Páginas → **Avisarme de descuentos** permite silenciar una página. Las páginas actuales de Deseos/Próximos se iniciaron activas al añadir esta función; los objetivos existentes se conservaron.

En iOS/iPadOS, usar la app añadida a la pantalla de inicio y un sistema compatible con Web Push. El permiso se solicita dentro del toque del usuario, antes de cualquier espera de red ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)).

## Operación

El worker de precios conserva su horario cada tres horas y solo consulta Steam/Nintendo para Deseos/Próximos. El worker notification-worker funciona por separado cada cinco minutos mediante Supabase Cron: consulta fechas locales y procesa la cola; no hace llamadas a tiendas.

notification_preferences guarda los tres interruptores y el inicio de avisos de lanzamiento. notifications contiene el historial con tipo, juego, enlace, lectura y fecha de envío; Realtime actualiza las novedades. La campana abre Configuración y cuenta solo avisos no leídos.

notification_deliveries registra cada combinación aviso/dispositivo. Las reclamaciones usan bloqueo, lease y token para evitar envíos simultáneos; se reintentan fallos temporales hasta ocho veces, durante 24 horas. Las respuestas 404/410 eliminan suscripciones vencidas. Un dispositivo correcto no se repite por el fallo de otro. La cola no está disponible para clientes, solo el worker. La confirmación del servicio push no garantiza que el sistema operativo muestre el aviso: la prueba real debe completarse en el teléfono.

El test se dirige solo al dispositivo que lo solicitó y tiene un límite de una prueba por minuto/cuenta. Sin suscripciones no se marca el evento como enviado; al registrar un teléfono no se envían avisos anteriores a su suscripción. Las pulsaciones abren la sección correspondiente dentro del mismo origen.

Funciones internas y credenciales permanecen en Supabase; no se devuelven endpoints, claves push ni configuración de Vault en errores. Los respaldos diarios incluyen preferencias e historial; no incluyen suscripciones push, cola transitoria ni claves.

## Verificación

- Tests de descuentos, objetivo estricto, ausencia de alertas repetidas, preferencias, juegos silenciados/fuera de listas, lanzamientos, aislamiento por cuenta, permisos, reclamaciones concurrentes y reintentos por dispositivo en tests/notifications.integration.sql (rollback, sin red).
- Tests de API, permiso antes de esperar la red, worker autenticado, parser de fechas, enlaces seguros y tratamiento de fallos en tests/notifications.test.ts y tests/notification-settings.test.ts.
- Inspección de Configuración a 1440 y 390 px, guardado y reversión de preferencias tras fallo de red, envío de prueba simulado y lectura de avisos.
- Worker remoto comprobado con HTTP 200. La recepción física de push en el teléfono queda pendiente de activar el dispositivo y pulsar la prueba después de publicar el frontend.

El asesor informa RLS sin políticas en las tablas internas de cola y snapshots: es intencional, con acceso de navegador revocado ([referencia](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). El aviso preexistente de protección de contraseñas filtradas sigue sin cambios ([referencia](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).
