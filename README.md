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
