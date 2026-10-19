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

Abrir http://localhost:3000. Las claves privilegiadas y VAPID viven en Supabase Vault; la aplicación web usa una publishable key y la sesión de cada persona.

## Comprobaciones

```powershell
npm test
npm run typecheck
npm run build
npm run test:e2e
```

La prueba autenticada requiere una cuenta **descartable e invitada**, con biblioteca vacía, mediante `E2E_EMAIL` y `E2E_PASSWORD`. Crea datos de prueba; nunca ejecutarla con una cuenta personal. Los SQL de integración en `tests/*.integration.sql` se ejecutan en transacciones con rollback. Para entornos con proxy, `PLAYWRIGHT_PROXY_FROM_ENV=1` habilita el proxy HTTP del entorno en Chromium.

## Configuración

- [Plan aprobado](docs/implementation-plan.md)
- [Estado y verificaciones](docs/status.md)
- [Instalación y operaciones](docs/setup.md)

No subir `.env.local`, enlaces de invitación, exportaciones personales ni datos reales al repositorio público.

## Exportaciones personales

En Configuración → Datos se pueden descargar todos los juegos, sin aplicar los filtros de la vista:

- **Excel (.xlsx):** hojas Juegos, Páginas e Historial de precios, con encabezados en español, filtros y fechas dd/mm/aaaa. Incluye todas las partidas, también las pendientes y los recuerdos; los comentarios largos continúan en columnas adicionales para no recortarlos.
- **Respaldo JSON:** registros originales, páginas de tiendas e historial de precios, incluidos IDs y datos originales de importación.
- **CSV:** todos los campos de los juegos y sus enlaces, para copiar o importar en otra planilla.

Los archivos solo contienen datos de la cuenta que inició sesión. Se descargan al dispositivo: no escriben en Google Sheets. Guardar versiones fuera de la app, por ejemplo en una carpeta personal de Drive. JSON es una copia de los datos del diario, no una copia de la base entera: no incluye cuentas, contraseñas ni configuración del servicio. La restauración desde JSON todavía es manual; no existe un botón de restauración.

El lector UUID de ExcelJS se fija mediante un override compatible con CommonJS para evitar la dependencia vulnerable anterior.
