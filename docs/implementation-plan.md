# Game Journal — plan de implementación

Estado: aprobado el 16/10/2026. Repositorio Korian99/game-journal.
Proyecto Supabase: pgosoyxbuxfrkfjvmflm (us-east-2).

## Producto

Aplicación web instalable en español, tablas en escritorio y listas en móvil, tema oscuro con opción clara. Usuarios invitados con email/contraseña; sin registro público. Biblioteca, Diario, Lista de deseos, Próximos, Compartido conmigo y Configuración. Priorizar servicios gratuitos; no contratar servicios pagos sin aprobación.

## Arquitectura

Next.js App Router + TypeScript + Tailwind + componentes accesibles + TanStack Table.
Supabase PostgreSQL, Auth, Realtime, Cron y Edge Functions. Hosting Next.js preparado para Vercel.
Credenciales privilegiadas exclusivamente en servidor; RLS en todas las tablas expuestas. Dependencias fijadas y lockfile versionado. No subir datos personales al repositorio público.

## Modelo y flujos

- Juegos/ediciones separados de playthroughs y ofertas. Remakes diferentes, múltiples dispositivos/partidas.
- Biblioteca personal: comprado, acceso familiar, prioridad, estado, hype.
- Diario: fechas exactas o períodos aproximados, horas, reseña 0–100, memorabilidad e impresiones históricas en sus escalas originales, historia/gameplay, rejugaría, motivos y comentarios privados.
- Ofertas: múltiples links por juego; Steam/Nintendo y sus regiones; moneda explícita, precio normal/final, descuento, lanzamiento, última consulta e historial de cambios. Sin conversión de monedas ni impuestos estimados.
- Importaciones, procedencia y valores originales, suscripciones push, notificaciones e invitaciones.
- Privacidad por defecto. Compartir entradas elegidas con destinatarios elegidos; solo lectura de campos aprobados, nunca notas privadas, motivos, biblioteca o wishlist. Revocación inmediata por RLS.
- Administrador inicial mediante comando de una sola ejecución. Invitaciones y recuperación con enlaces privados copiados manualmente; SMTP automático fuera de la primera entrega.

## Importación Google Sheets

Conexión Google separada del login. Picker + drive.file para seleccionar archivo. Acceso temporal solo durante importación; nunca escribir en Sheets.
Importar Tablas, 2025, 2026, <2025 y explicaciones de escalas. Leer encabezados, no posiciones fijas.
Vista previa de altas/cambios/duplicados/conflictos antes de aplicar. Comparación a tres bandas con valores importados anteriormente; conflictos se resuelven por campo. No borrar entradas ausentes de la fuente. No duplicar filas reordenadas ni sobreescribir ediciones hechas en app.
Preferir IDs de tienda y matching conservador título/edición; juegos y partidas ambiguos requieren revisión. No inventar fechas, ceros ni escalas. Exportación JSON y CSV.
La planilla sigue funcionando en paralelo con sus scripts mientras se migra.

## Precios y push

Adaptadores separados Steam y Nintendo, resultado estructurado. Validar dominios/rutas/redirecciones. Nintendo usa datos estructurados y fallback probado.
Precio, fecha futura, Early Access, gratis/no disponible y error son estados distintos. Un error conserva el último precio válido.
Cron cada 3 horas: 02,05,08,11,14,17,20,23 en America/Argentina/Buenos_Aires. Procesamiento por lotes acotados, sin solapamiento, retry/backoff; refresh manual con límite de frecuencia.
Android PWA + Web Push VAPID. Opt-in explícito. Vigilar varias ofertas, objetivos opcionales en moneda propia. Alertar nueva oferta o reducción adicional; primera consulta solo establece referencia. Deduplicar por evento y limpiar endpoints vencidos. Historial interno; push best effort. Sin edición offline en v1.

## Secuencia y aceptación

1. Base, migraciones, RLS, login, bootstrap administrador y navegación responsive.
2. Biblioteca/diario editables, filtros, escalas y Realtime entre dispositivos.
3. Google OAuth/Picker, preview/aplicar, conflictos y export; datos reales solo después de identificar al propietario.
4. Varias ofertas, adaptadores, historial, jobs/cron y estado de salud.
5. Sharing selectivo y Android push.
6. Configuración externa, despliegue, pruebas en producción y habilitar cron tras validar escritor.

Pruebas obligatorias: importar sin duplicados tras reordenar; conflictos preservan ediciones; períodos/escalas sobreviven export; ofertas regionales separadas; fixtures de parsing, gratis/EA/próximos/errores/429; concurrencia entre dispositivos; aislamiento entre dos usuarios y revocación; cron sin navegador y sin duplicados; Android push, rechazo de permisos y endpoints vencidos. Typecheck, build, pruebas unitarias/integración y E2E.

## Prerrequisitos de despliegue

Cuenta Vercel, OAuth Google (cliente web, Picker API y key restringida), secreto servidor Supabase, VAPID y URL HTTPS. Bootstrap recibe email del propietario por parámetro; nunca inferirlo ni almacenar contraseñas en Git. Mantener un registro honesto de verificaciones y pendientes en docs/status.md.
