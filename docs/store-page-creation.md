# Carga de un juego desde una página

Al agregar un juego nuevo, se puede elegir **Usar una página** o **Completar manualmente**. Las partidas nuevas de un juego existente y la edición de entradas existentes abren directamente el formulario.

La primera opción acepta una sola página de producto de Steam o Nintendo por consulta. `POST /api/store-preview` verifica la cuenta activa y consulta la tienda desde Node; no crea juegos, ofertas ni historial. El usuario revisa y completa el borrador y recién **Guardar entrada** usa el flujo normal de validación, duplicados y revisión del servidor.

## Datos y límites

- Steam: nombre, PC cuando la API declara un sistema compatible, lanzamiento reconocible y cotización regional (precio actual, regular, moneda, descuento y disponibilidad).
- Nintendo: nombre y sistema del producto seleccionado, lanzamiento estructurado o del apartado de lanzamiento, y cotización pública verificable. No se usan productos relacionados ni fechas de imágenes.
- Solo se completan campos existentes que la tienda informa. Las plataformas y el lanzamiento corresponden a esa versión de tienda; no representan un catálogo de todas las versiones del juego.
- No se inventan duración estimada, compra/acceso, prioridad, estado de partida, reseña ni fechas de juego. Estos datos siguen siendo personales.
- Las cotizaciones se muestran como una consulta fechada en el editor. Guardar incorpora la página; los precios e historial persistidos siguen siendo responsabilidad del worker existente, con su elegibilidad y programación actuales.
- La opción **Completar desde una página** también está disponible en Principal. Reemplaza el nombre y lanzamiento informado, incorpora las plataformas y añade el enlace; conserva la partida y los comentarios personales.

## Errores y cancelación

El usuario puede reintentar o continuar manualmente conservando el enlace. Los cierres con cambios solicitan confirmación. Salir de una consulta cancela su solicitud y una respuesta tardía no puede reemplazar el borrador.

El endpoint acepta solo los hosts y formatos de producto permitidos por `parseStoreUrl`, conserva la región, rechaza redirecciones fuera del host original, limita la respuesta descomprimida a 8 MB y aplica un plazo de consulta de 12 segundos. Las respuestas del endpoint son privadas y no se almacenan en caché.

## Archivos y verificación

- `components/games/editor/entry-start.tsx`: elección inicial y consulta cancelable.
- `components/games/entry-editor.tsx`: borrador compartido y aplicación de campos.
- `components/games/editor/store-preview-card.tsx`: cotización temporal.
- `lib/offers/store-preview-contract.ts`: contrato validado, compartido con el cliente.
- `lib/offers/store-preview.ts`: lectura limitada, selección de producto y normalización de fechas.
- `tests/store-preview.test.ts` y `e2e/mocked/entry-start.spec.ts`: API con tiendas simuladas y recorridos de escritorio/móvil.

No requiere migración, configuración adicional ni cambios en los workers.

Si al editar una partida la página coincide con otro juego, el diálogo permite volver al borrador o guardar los cambios en la misma partida, conservando sus IDs, revisión, estado, fechas y notas. Las opciones de crear otra partida o un juego separado solo se ofrecen al crear una entrada nueva. No se fusionan juegos automáticamente.
