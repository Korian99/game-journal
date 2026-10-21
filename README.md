# Game Journal

Diario personal de videojuegos en español. Next.js, TypeScript y Supabase. Biblioteca y partidas, lista de deseos, próximos lanzamientos, ofertas regionales, importación revisada de Google Sheets y entradas compartidas por invitación.

## Desarrollo

Requiere Node.js 22 o superior.

```powershell
npm ci
Copy-Item .env.example .env.local
# Completar URL y publishable key de Supabase.
npm run dev
```

Abrir http://localhost:3000. La aplicación en el navegador usa una publishable key y la sesión de cada persona. VAPID y los refresh tokens de Drive viven en Supabase Vault. El worker de copias usa credenciales privilegiadas únicamente en el servidor; ver la guía de configuración.

## Comprobaciones

```powershell
npm run lint
npm test
npm run typecheck
npm run build
npm run test:browser
# Opcional: Docker, bases descartables
npm run test:database
# E2E autenticado: solo con cuenta descartable
npm run test:e2e
```

La prueba autenticada requiere una cuenta **descartable e invitada**, con biblioteca vacía, mediante `E2E_EMAIL` y `E2E_PASSWORD`. Crea datos de prueba; nunca ejecutarla con una cuenta personal. Los SQL de integración en `tests/*.integration.sql` se ejecutan en transacciones con rollback. Para entornos con proxy, `PLAYWRIGHT_PROXY_FROM_ENV=1` habilita el proxy HTTP del entorno en Chromium.

## Configuración

- [Mapa del código](docs/codebase-map.md)
- [Plan aprobado](docs/implementation-plan.md)
- [Roadmap actualizado](docs/improvement-roadmap.md)
- [Papelera, Drive y recuperación](docs/improvements-setup.md)
- [Estado y verificaciones](docs/status.md)
- [Instalación y operaciones](docs/setup.md)

No subir `.env.local`, enlaces de invitación, exportaciones personales ni datos reales al repositorio público.

## Exportaciones personales

En Configuración → Datos se pueden descargar todos los juegos, sin aplicar los filtros de la vista:

- **Excel (.xlsx):** hojas Juegos, Páginas e Historial de precios, con encabezados en español, filtros y fechas dd/mm/aaaa. Incluye todas las partidas, también las pendientes y los recuerdos; los comentarios largos continúan en columnas adicionales para no recortarlos.
- **Respaldo JSON:** registros originales, páginas de tiendas e historial de precios, incluidos IDs y datos originales de importación.
- **CSV:** todos los campos de los juegos y sus enlaces, para copiar o importar en otra planilla.

Los archivos solo contienen datos de la cuenta que inició sesión. Se descargan al dispositivo: no escriben en Google Sheets. Las copias automáticas se describen abajo. Guardar versiones fuera de la app, por ejemplo en una carpeta personal de Drive. JSON es una copia de los datos del diario, no una copia de la base entera: no incluye cuentas, contraseñas ni configuración del servicio. La recuperación completa usa un bundle diario JSON + Excel + manifiesto verificado, con un comando de validación y generación de SQL para un proyecto vacío; ver docs/improvements-setup.md. No existe restauración automática sobre datos actuales.

El lector UUID de ExcelJS se fija mediante un override compatible con CommonJS para evitar la dependencia vulnerable anterior.

## Respaldos diarios

Supabase Cron ejecuta private.run_daily_backups() a las **06:00 UTC / 03:00 Argentina**. No depende de Vercel ni de abrir la web. Una captura por cuenta activa y día; reintentar una captura correcta no genera duplicados.

- private.backup_snapshots conserva los últimos **30 respaldos correctos por cuenta**, como JSONB. public.backup_runs registra hora, resultado, cantidades, bytes y SHA-256; los registros sin copia se conservan 90 días.
- Cada captura lee juegos, partidas, tiendas, historial, importaciones, notificaciones, perfil y permisos de compartir propios en una misma instantánea SQL. Incluye los registros combinados del exportador y tablas originales para restauración manual. No incluye credenciales de Auth, sesiones, suscripciones push, Vault, esquema SQL ni archivos de Storage.
- Datos y registro correcto se confirman en una sola transacción. Un fallo revierte la captura parcial, deja un registro fallido cuando la base puede escribir y no elimina copias anteriores. Los fallos globales del proceso quedan además en el historial de Cron.
- Los miembros solo pueden leer su historial y descargar su última copia; no pueden crear, modificar ni borrar los respaldos mediante la API. La descarga verifica SHA-256.
- La web consulta el estado al abrir, al volver a la ventana y cada cinco minutos; avisa si no hay copia, si falló la última ejecución, si no se puede comprobar o si la última copia correcta tiene **48 horas**. Las fechas se muestran en horario argentino.
- Configuración ofrece la última copia guardada y exportaciones actuales. La recuperación usa el comando backup:restore, valida el manifiesto y requiere primero un proyecto vacío descartable con mapeo explícito de propietario. Los permisos de compartir y credenciales no se restauran. Nunca aplicar restauración automática sobre datos actuales.

Estas son copias de los **datos de la aplicación dentro del mismo proyecto**, no backups físicos ni PITR de Supabase. Ayudan frente a ediciones y borrados accidentales de juegos; **no sobreviven a borrar/perder el proyecto ni reemplazan una copia externa**. Exportar periódicamente JSON/Excel a otro servicio o dispositivo. Si el proyecto se pausa o la base queda indisponible, Cron no ejecuta y el aviso aparecerá cuando la app pueda consultarlo.

## Notificaciones

Configuración permite activar este dispositivo, elegir descuentos, ofertas por debajo de Objetivo y lanzamientos, y enviar una prueba. [Uso, horarios y verificación](docs/notifications.md).

## Mejoras preparadas localmente

Papelera de 30 días, copias privadas JSON/Excel en Google Drive, avisos de duplicados, acciones rápidas, historial de notificaciones y Estadísticas. La edición sin conexión se retiró del alcance; guardar requiere conexión. Revisar y aprobar las migraciones antes de publicar estas funciones. No se modifican planillas.
