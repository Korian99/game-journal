# Estado de Game Journal — 16/10/2026

## Implementado

- Aplicación en español: Biblioteca, Diario, Deseos, Próximos, Compartido conmigo y Configuración.
- Tablas con búsqueda/filtros/orden en escritorio; listas en móvil, tema oscuro/claro y formularios accesibles.
- Cuenta administradora inicial creada; invitaciones y recuperación por enlaces privados. No se eligió una contraseña por el titular.
- Juegos y partidas separados; varias partidas del mismo juego, campos históricos y comentarios privados.
- Sincronización mediante Supabase Realtime y control de versiones al guardar, incluso entre partidas del mismo juego.
- RLS por propietario; compartir entradas con destinatarios concretos mediante una proyección limitada y revocación en servidor.
- Google Picker y OAuth drive.file, preview, conflictos por campo, importación transaccional e idempotencia por lote. No modifica Sheets.
- Exportación JSON y CSV.
- Ofertas Steam/Nintendo por región, monedas explícitas, objetivo de precio, historial, último intento y último precio válido.
- Worker desplegado y cron activo cada tres horas en el horario acordado.
- VAPID generado dentro de Supabase; suscripción push voluntaria, deduplicación de eventos y manifiesto PWA con iconos PNG.
- Plan, instrucciones y limitaciones guardados en Markdown.

## Verificaciones completadas

- 18 pruebas automatizadas de dominio, más una prueba opcional contra HTML real de Nintendo: **19 pasaron** al habilitar el fixture local.
- Producción: `npm run build` correcto; `npm run typecheck` correcto.
- Cuatro E2E pasaron: login privado, acceso anónimo rechazado, móvil sin desborde y recorrido autenticado con altas, enlaces, nuevas partidas, exportación y conflicto de edición.
- Inspección visual de la biblioteca en 1280 px y 390 px.
- SQL de aislamiento entre dos usuarios, proyección compartida y revocación: aprobado en la primera verificación.
- SQL de importación atómica, enlaces regionales, rechazo de lotes repetidos y ediciones viejas: aprobado.
- SQL de concurrencia entre partidas del mismo juego: aprobado.
- Worker alojado consultó Steam y guardó región, moneda, precio e historial sin navegador. Primera referencia sin notificación.
- Parser Nintendo comprobado con el enlace del script original: moneda ARS, precio normal/final y descuento leídos del producto correspondiente.
- Auditoría de dependencias: sin vulnerabilidades reportadas en la instalación.
- Credenciales y datos personales excluidos del repositorio.

## Pendiente de configuración externa

- Google Cloud: cliente OAuth, número de proyecto y API key restringida para importar la planilla real.
- Vercel y dominio HTTPS. El servidor actual corre localmente en http://localhost:3000.
- Verificar en el proyecto remoto que el registro público esté deshabilitado y el mínimo de contraseña sea 8. La configuración local ya impide signup.
- Prueba de Web Push en un Android real, incluyendo denegación de permisos y suscripciones vencidas.
- Prueba de la importación con la planilla real una vez que el propietario tenga acceso. No se importaron datos personales.

El asesor de Supabase solo mantiene el aviso de protección de contraseñas filtradas deshabilitada. Revisar disponibilidad del plan en [Supabase Password Security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); no se activaron servicios pagos.

## Observaciones operativas

Las llamadas de MCP que contienen borrados devolvieron `Invalid or expired requestState`. La cuenta QA se dejó deshabilitada, bloqueada y con contraseña aleatoria; sus ofertas no se procesan por pertenecer a un miembro inactivo. La limpieza definitiva del fixture queda pendiente. No se borraron datos de ninguna cuenta personal.

Los títulos renombrados en Sheets pueden necesitar asociación manual: la v1 reconoce filas por pestaña y título normalizado, no por coincidencia aproximada. Al eliminar una entrada se elimina la partida; sus metadatos y ofertas pueden conservarse para otras partidas/historial.

La publicación en GitHub y el despliegue siguen pendientes. Ninguna planilla original fue modificada.
