# Estado local — 21/10/2026

La aplicación publicada y sus datos no se modificaron durante este trabajo. Los cambios siguientes están en el árbol de trabajo local, sin commit, push ni deploy.

Implementado: recursos tipados y validados, errores con código/HTTP, recargas independientes y agrupadas, formulario dividido en cuatro componentes con protección de cambios, Papelera de 30 días con Deshacer/restaurar, copias externas privadas en Drive, advertencias de duplicados, acciones rápidas, historial de notificaciones y Estadísticas.

La edición sin conexión se retiró del alcance por pedido del titular. No quedan una cola local, IndexedDB ni una migración de sincronización.

Las migraciones nuevas todavía requieren revisión del SQL y autorización antes de ejecutarse en producción. Google Drive requiere configurar un cliente OAuth y autorizar una vez la cuenta desde Configuración. No se activaron servicios pagos ni se escribió en Sheets.

La recuperación automatizada se verifica con datos sintéticos y dos bases PostgreSQL descartables: aplica migraciones, prueba RLS y permisos, verifica el bundle JSON/Excel/manifiesto y restaura con otro propietario. Esto no sustituye una prueba real con Google Drive una vez configurado.

- [Roadmap y alcance](improvement-roadmap.md)
- [Configuración y recuperación](improvements-setup.md)
- [Mapa del código](codebase-map.md)

El estado anterior del 16/10/2026 se conserva como registro histórico en archive/status-2026-10-16.md; sus pendientes de despliegue y configuración no describen el entorno actual.
