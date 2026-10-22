# Guía personal de reseñas

La guía se abre desde **Configuración** o el botón **Guía de reseñas** de la pestaña Reseña del editor. Es informativa: no convierte notas, no cambia las reseñas existentes y no modifica estadísticas ni insignias.

Cada cuenta tiene sus propios puntajes y significados. Hasta guardar una personalización se muestran los once valores iniciales, de 100 a 0, proporcionados por el usuario. Se pueden editar ambos campos, añadir o quitar puntajes, cancelar cambios y recuperar la guía inicial en el borrador antes de guardarla. Debe quedar al menos un puntaje; cada entero entre 0 y 100 aparece como máximo una vez. Los significados admiten hasta 2000 caracteres.

## Persistencia

- `public.scoring_guide`: clave primaria `(owner_id, score_threshold)`, FK a `auth.users`, significado y restricciones.
- RLS exige una cuenta miembro activa y propiedad tanto para leer como para escribir; grants explícitos, sin acceso anónimo.
- `GET /api/scoring`: guía propia ordenada de mayor a menor, o valores iniciales si aún no hay filas. Los errores de lectura no se ocultan con valores iniciales.
- `PUT /api/scoring`: valida y reemplaza la guía completa mediante una única transacción `replace_scoring_guide(jsonb)`. El propietario se obtiene de la sesión y nunca del cuerpo del cliente. Los guardados simultáneos de la misma cuenta se serializan; prevalece el último guardado completo.
- Guardar la guía no guarda ni cierra el juego. Un error mantiene el borrador de la guía.
- Los borradores de la guía viven en memoria hasta guardar. Cerrar su diálogo o cancelar avisa si hay cambios; recargar/cerrar la pestaña también avisa. Cambiar de sección de Configuración descarta su borrador: guardar o cancelar antes de navegar.

## Exportación y recuperación

JSON y Excel manuales incluyen la guía; CSV conserva su estructura de juegos. Excel incorpora la hoja **Guía de reseñas**. No se escribe en Google Sheets.

El respaldo diario pasa a versión 5 e incluye `sourceTables.scoring_guide` en la misma consulta que los demás datos. No cambia horarios, retención ni política de archivos. La copia externa incluye la guía en su JSON y Excel. Recuperar remapea el propietario y rechaza un destino que ya contenga una guía. Los respaldos antiguos de versiones 3/4 siguen siendo compatibles.

## Rollout en producción

El propietario aprobó la migración y se aplicó en Supabase el 22/10/2026 mediante la API oficial de migraciones, con la versión 20261022140552. El archivo local se alineó con esa versión sin cambiar los bytes SQL.

La entrega incluye el lector de respaldos de versión 5 y conserva compatibilidad con versiones 3/4. Publicar este código junto con la migración permite consultar y guardar la guía desde la app. Los conteos de juegos, partidas, ofertas e historial se conservaron durante la aplicación. No se modifica la planilla.
