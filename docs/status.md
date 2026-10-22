# Estado de las mejoras — 22/10/2026

Este documento resume el alcance y la verificación de las mejoras. La base, el rediseño de Diario y las correcciones de revisión están guardados en Git. El titular solicitó commit, push y despliegue el 21/10/2026. Consultá Git, Vercel y el historial de migraciones para confirmar el estado actual de publicación.

Implementado: recursos tipados y validados, errores con código/HTTP, recargas independientes y agrupadas, formulario dividido en cuatro componentes con protección de cambios, Papelera de 30 días con Deshacer/restaurar, copias externas privadas en Drive, advertencias de duplicados, acciones rápidas, historial de notificaciones y Estadísticas.

La edición sin conexión se retiró del alcance por pedido del titular. No quedan una cola local, IndexedDB ni una migración de sincronización.

Las tres migraciones de permisos, Papelera/guardado y copias externas se aplicaron en producción el 22/10/2026 con aprobación explícita. Las funciones nuevas están disponibles; los conteos se mantuvieron en 211 juegos, 212 partidas, 175 páginas y 158 registros de precio. Google Drive requiere configurar un cliente OAuth y autorizar una vez la cuenta desde Configuración. No se activaron servicios pagos ni se escribió en Sheets.

La recuperación automatizada se verifica con datos sintéticos y dos bases PostgreSQL descartables: aplica migraciones, prueba RLS y permisos, verifica el bundle JSON/Excel/manifiesto y restaura con otro propietario. Esto no sustituye una prueba real con Google Drive una vez configurado.

- [Roadmap y alcance](improvement-roadmap.md)
- [Configuración y recuperación](improvements-setup.md)
- [Mapa del código](codebase-map.md)
- [Revisión de implementación y pruebas](implementation-review.md)

El estado anterior del 16/10/2026 se conserva como registro histórico en archive/status-2026-10-16.md; sus pendientes de despliegue y configuración no describen el entorno actual.
