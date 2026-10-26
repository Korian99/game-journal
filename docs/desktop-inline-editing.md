# Edición directa de tablas

La edición directa está disponible en las tablas de escritorio. No necesita migraciones.

En escritorio, pulsar un valor abre su editor dentro de la tabla. Enter o el botón de confirmación guarda; Escape cancela. En textos largos, Enter agrega una línea y Ctrl+Enter guarda. Los selectores también tienen confirmación explícita. Salir de una celda no guarda automáticamente. Si el valor no cambió, pulsar afuera cierra el editor y permite pasar directamente a otra celda o a los detalles. También se reconocen formatos equivalentes (fechas, números y espacios del nombre). Un borrador cambiado o inválido se conserva hasta guardar o cancelar.

El botón de lápiz junto al título abre el formulario completo. En móvil, tocar la tarjeta sigue abriendo ese formulario.

- Biblioteca: nombre, consola jugada, estado, reseña, inicio/fin, horas registradas/estimadas, motivo, impresiones y comentarios existentes.
- Diario: nombre, consola, estado, período, lanzamiento, reseña, memorabilidad, impresiones y comentarios existentes. La insignia de impresiones edita su valor original, no el resultado multiplicado por diez.
- Lista de deseos: nombre, prioridad, acceso y horas estimadas.
- Próximos: nombre, lanzamiento (fecha/temporada/año/desconocido) y Hype.

Precios y plataformas calculadas desde páginas son informativos. Páginas y demás datos siguen en el formulario completo. Los campos no visibles se completan allí también.

## Guardado y deshacer

useInlineEditing conserva una sola celda abierta y su versión base. El mismo recordSchema y POST /api/records validan el guardado, duplicados y revisión esperada. Un error mantiene el borrador. Se aplica la respuesta canónica antes de actualizar en segundo plano; una actualización fallida no convierte un guardado confirmado en error. Los metadatos del juego se actualizan en sus otras partidas sin copiar reseñas ni horas entre ellas.

Deshacer o Ctrl+Z (Cmd+Z en Mac) revierte cambios guardados de esta sesión, hasta 50. Dentro de inputs y del formulario completo se conserva el deshacer nativo del navegador. No hay redo ni historial persistente entre recargas.

Cada operación recuerda únicamente los campos que realmente cambiaron, incluidos estado/fechas/período derivados. Deshacer combina los valores anteriores con la entrada actual y exige que los campos a revertir aún tengan los valores guardados por esa operación. Cambios nuevos en otros campos se conservan; un conflicto o una entrada ausente no se sobrescribe. La revisión actual vuelve a comprobarse al guardar. El intent undo conserva las fechas y el período restaurados sin ejecutar otra vez los automatismos de un cambio de estado.

El borrador permanece al cambiar filtros o pestaña; Volver a la celda permite retomarlo. Cerrar sesión se bloquea mientras haya una edición pendiente; salir o recargar activa el aviso del navegador. El borrador y el historial no son almacenamiento sin conexión.

## Pruebas

Las pruebas de dominio verifican validación, fechas/estados/período, restauración selectiva, releases importados y metadatos compartidos. Las pruebas del API comprueban la restauración histórica sin quitar el control de revisión. Los escenarios de navegador usan servicios simulados y cubren escritorio/móvil, controles por tabla, errores, selectores, deshacer múltiple y protección frente a cambios posteriores. No escriben datos personales.
