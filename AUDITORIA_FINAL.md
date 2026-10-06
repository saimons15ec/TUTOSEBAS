# Auditoría final de TUTOSEBAS

Fecha: 6 de octubre de 2026 (UTC). Base revisada: versión publicada 87, fuente `495b44df9bce104254eb30af79389d450aaedfeb`. La revisión corregida se publicó como versión 88, fuente 3fc847e38161ff9c889c4c19b0f608044c9996c3; publicación y acceso privado verificados.

La plataforma funciona como piloto privado. La apertura independiente queda condicionada a conectar el proveedor de autenticación, verificar el respaldo final de migración y revisar el contenido destinado a estudiantes. Esta auditoría de código, dependencias, inventario y pruebas no equivale a una prueba de penetración externa ni a una certificación de seguridad.

## Qué está bien

- Frontend React/TypeScript con Vinext/Vite; backend Cloudflare Workers; D1 para registros y R2 para archivos. Las funciones requieren backend: GitHub Pages por sí solo no sirve para este proyecto.
- La cuenta principal verificada de GitHub es `saimons15ec`; `saimons15ec/TUTOSEBAS` es privado. La ficha de esa cuenta en TUTOSEBAS tiene función de administrador.
- La sesión actual exige autorización de Sites y correo habilitado dentro de TUTOSEBAS. Un inicio de sesión no crea automáticamente una cuenta estudiantil.
- Roles, grupos, planes, periodos y permisos se comprueban en el servidor. El estudiante no recibe respuestas correctas antes de terminar un intento ni historiales de otros estudiantes.
- Archivos privados servidos mediante API autorizada, límite de 25 MiB, extensión/firma/tipo, bloqueo de formatos ejecutables y determinados contenidos activos de PDF/Office, inventario y SHA-256. La validación de formatos no es un escáner antivirus completo.
- Consultas parametrizadas, validaciones de tamaño y JSON, limitación de solicitudes, auditoría, cabeceras de seguridad y respuestas privadas sin caché.
- Barrido de 275 archivos de fuente, 89 commits y 770 blobs únicos: sin coincidencias de patrones revisados de claves OpenAI, GitHub, AWS, Supabase o claves privadas. Solo `.env.example` está versionado. Es una búsqueda por patrones, no una garantía absoluta de ausencia de secretos.

## Hallazgos y correcciones

| Prioridad | Hallazgo | Resultado de esta revisión |
|---|---|---|
| Urgente | Copiar la identidad por cabeceras de Sites a otro hosting permitiría suplantaciones si ese hosting aceptase cabeceras del visitante. | Adaptador separado: en modo contraseña ignora completamente las cabeceras Sites. `APP_DEPLOYMENT=independent` exige `APP_AUTH_MODE=password`; no hay acceso local automático en ese modo. |
| Urgente | La autenticación por correo y contraseña todavía no existía. | Preparados alta de credenciales solo para fichas registradas, cambio inicial obligatorio, sesiones opacas en servidor, cierre, suspensión, restablecimiento y reautenticación del administrador. Proveedor real aún sin conectar. |
| Urgente | Auditoría inicial de producción: 1 aviso crítico, 1 alto y 1 moderado. | Next/eslint-config-next 16.3.6; fast-uri 3.1.8; source-map-js 1.2.2. También actualizados undici 7.29.1 y brace-expansion 1.1.21/5.0.12 de herramientas. Auditoría final de producción: 0 avisos. |
| Alta | El respaldo lógico contenía referencias a archivos, sin sus bytes. | Nueva descarga privada de ZIP con tablas, archivos, manifiesto SHA-256 y verificador/restaurador aislado. La copia actual recibida se verificó y restauró de forma aislada; repetir el respaldo final después de vincular credenciales y antes del traslado. |
| Alta | `Number(null/false/"")` podía convertir una respuesta correcta incompleta en alternativa A al crear/aprobar preguntas. | Validación numérica estricta al crear, aprobar y practicar; rechazo de valores implícitos. |
| Alta | El origen de una mutación podía compararse con `host`/`x-forwarded-host` aportados en la solicitud. | Comparación con el origen real de la URL. Acciones de contraseña requieren además el origen HTTPS configurado. |
| Alta | Una suspensión no revocaba sesiones del nuevo método. | Borrado de sesiones al suspender; cada lectura vuelve a verificar estado y versión de credenciales. Un administrador suspendido tampoco se reactiva al autenticar. |
| Media | Faltaban exclusiones para secretos `.dev.vars` y restauraciones locales. | Añadidas exclusiones para `.dev.vars*`, respaldos, bases SQLite y configuración local de producción. |
| Pendiente | `braces` tiene un aviso alto, sin versión corregida, en herramientas de desarrollo. | Documentado; no se ignoró en la auditoría. Se usa al compilar/lintar código confiable, no desde rutas de estudiante. No exponer servidores de desarrollo ni construir patrones suministrados por visitantes. Revisar cuando exista parche. |
| Pendiente | La CSP permite scripts y estilos inline por compatibilidad con el renderizado actual. | Mantenerla documentada; estudiar nonces con Vinext y comprobar en navegador antes de cambiarla. |

Los parches exactos publicados recientemente tienen excepciones limitadas de antigüedad en `pnpm-workspace.yaml`; el resto conserva la política de espera de siete días. No se redujo globalmente la protección de instalación.

## Inventario académico y límites de la lectura

Lectura nativa de todas las páginas: 115 registros, 7 perfiles y 12 archivos registrados activos, con hashes, que suman 37.829.326 bytes. Los valores JSON de 12 registros largos fueron truncados por el lector; no se usaron esos fragmentos para reconstruir datos ni se declaró una revisión íntegra de su contenido.

- 49 preguntas: 46 aprobadas y 3 pendientes. Las 49 se pudieron clasificar.
- 20 aprobadas del periodo vigente corresponden a Didáctica Ciencias Naturales, tema de Metodología. Deben revisarse como contenido académico antes de la apertura.
- 20 aprobadas corresponden al periodo histórico de Fin de Carrera; no forman un banco vigente de esa área.
- 6 aprobadas vigentes son preguntas funcionales de prueba. Deben separarse del contenido docente de apertura.
- 14 recursos: 9 publicados y 5 borradores; 3 cursos: 1 publicado y 2 borradores. No se encontraron lecciones de curso en este inventario.
- 6 simuladores: 3 borradores y 3 publicados; dos publicados son históricos y el publicado vigente corresponde al ensayo funcional. No hay un examen final vigente publicado listo para uso docente.

No archivar automáticamente contenido existente ni modificar los resultados de prueba. Antes del lanzamiento, el profesor debe confirmar materiales, preguntas, lecciones y simuladores válidos de cada materia. El primer grupo puede abrirse con un alcance académico concreto; Fin de Carrera necesita un banco vigente si se va a ofrecer en esa apertura.

## Acceso solicitado y seguridad

Ruta propuesta: Cloudflare propio (Workers + D1 + R2), GitHub privado personal y Supabase Auth únicamente para verificar contraseñas. No se necesita una API de OpenAI para importar los bloques de preguntas.

1. El profesor registra el correo exacto, grupo y estado de la ficha.
2. Desde Estudiantes y grupos, asigna una contraseña inicial única. El servidor crea la identidad en el proveedor y guarda su vínculo con la ficha; no adopta cuentas por coincidencia de correo.
3. El estudiante introduce correo y contraseña. Un correo no registrado, suspendido o sin credenciales no obtiene sesión.
4. La contraseña inicial solo permite cambiarla: no permite entrar a datos académicos o archivos.
5. La nueva contraseña queda gestionada por Supabase; TUTOSEBAS no la guarda en D1, GitHub, logs o respaldos. Los tokens del proveedor no se envían al navegador ni se conservan en D1.
6. El navegador recibe una cookie `__Host-`, Secure, HttpOnly, SameSite=Strict, de un token aleatorio de 256 bits. D1 guarda solo su SHA-256, con vencimiento absoluto de ocho horas e inactividad de treinta minutos.
7. Suspender, cerrar o restablecer revoca el acceso. Restablecer exige contraseña nueva al primer ingreso y conserva el historial académico.

Desactivar registro público y cuentas anónimas en Supabase. Los permisos siguen controlándose dentro de TUTOSEBAS aunque alguien tuviera una cuenta externa. El administrador debe reautenticarse para asignar contraseñas cuando use este método.

Las claves del proveedor se configuran como secretos del servidor. La contraseña temporal se entrega por un canal privado; no usar una clave compartida para todo el grupo. Proteger además las cuentas propietarias de GitHub, hosting, Drive y Supabase con segundo factor. El formulario nuevo no incluye MFA de aplicación; se debe evaluar para la administración antes de una apertura amplia.

Una alta remota que tenga éxito y falle antes de guardar su vínculo local requiere conciliación administrativa. No se permite iniciar sesión adoptando automáticamente esa cuenta por correo. Una operación interrumpida durante el cambio requiere revisar el estado de la identidad; el comportamiento por defecto es bloquear el acceso.

## Los 26 puntos de portabilidad

| Punto | Conclusión |
|---|---|
| 1. Diseño | Conservar las áreas y la ruta Materiales → Preguntas → Simuladores. |
| 2. Código | Copia completa y verificable de la revisión probada. |
| 3. Frontend | Se migra React/TypeScript, componentes y estilos. |
| 4. Backend | Se migra; requiere un runtime Workers compatible. |
| 5. Framework | Vinext beta; revisar compatibilidad en cada actualización. |
| 6. Dependencias | Lockfile y políticas de instalación incluidos; aviso de herramientas pendiente. |
| 7. Base de datos | Esquema SQL, migraciones y datos privados se trasladan por separado. |
| 8. Almacenamiento | R2 privado; copiar bytes, claves, tamaños y hashes. |
| 9. Autenticación | Adaptación preparada; falta conexión y prueba del proveedor real. |
| 10. Autorización | Se conservan controles por cuenta, grupo, plan, periodo y contenido. |
| 11. Usuarios | Conservar IDs académicos, nombres y grupos; asignar credenciales externas. |
| 12. Datos persistentes | Conservar registros e historiales; no reconstruir desde semillas. |
| 13. Archivos | ZIP privado con manifiesto; validar antes de restaurar. |
| 14. IA | No es necesaria en el flujo manual de bloques; integración futura opcional. |
| 15. APIs | Adaptar acceso y runtime; API externa de autenticación solo desde servidor. |
| 16. Entorno | Plantilla segura; secretos se vuelven a configurar fuera de Git. |
| 17. Sites | Mantener el piloto mientras se verifica la instalación propia. |
| 18. Work | No migrar chats, sesiones ni temporales. |
| 19. Servicios | GitHub/Drive personales verificados; hosting/auth por conectar. |
| 20. Seguridad | Correcciones verificadas y pendientes explícitos; sin afirmación de invulnerabilidad. |
| 21. Errores conocidos | Herramienta sin parche, altas parciales y dependencias de configuración. |
| 22. Funciones terminadas | Flujos académicos, planes, cursos, archivos y reportes probados con datos aislados. |
| 23. Funciones pendientes | Proveedor real, restauración en destino productivo, contenido de apertura, dominio y piloto externo. |
| 24. Dependencias del entorno | Separar plugin/proxy Sites del build independiente. |
| 25. Riesgos de migración | Cambiar IDs, perder binarios, abrir APIs sin auth o copiar secretos. |
| 26. Archivos A/B/C/D | Clasificación siguiente; datos privados fuera del código. |

## Qué se migra

Código fuente, interfaz, backend, componentes, configuración segura, lockfile, fuentes/licencias, pruebas, esquema y migraciones. Los datos académicos y binarios se trasladan en un respaldo privado separado. Conservar IDs de perfiles, grupos, registros y objetos.

## Qué no necesita migrar

Conversaciones, capturas fallidas, caches, sesiones ChatGPT, tokens activos, artefactos temporales y `node_modules`. No se exportan secretos ni contraseñas en el repositorio.

## Opcional

Fixture sintético de pruebas, paquetes de demostración y referencias A sin uso operativo. IA automática, escáner antivirus y MFA de aplicación requieren una decisión posterior según el alcance de apertura.

## Qué requiere adaptación

Autenticación, alojamiento, variables/secrets, bindings D1/R2, exportación/restauración de datos, DNS y HTTPS. Cambiar solo el formulario no elimina el control exterior de Sites.

## Archivos A/B/C/D

| Clase | Contenido | Destino |
|---|---|---|
| A: referencias | Documentos/capturas orientativas que no usa la aplicación. | Opcionales; conservar privados cuando corresponda. |
| B: incorporados | Esquema, código, estilos, fuentes/licencias y estructuras de preguntas. | Repositorio de código. |
| C: operativos | Perfiles, grupos, pagos, trabajos, preguntas guardadas, historial y archivos R2. | Respaldo privado e infraestructura de datos. |
| D: futuros | IA automática y posibles ampliaciones de seguridad/integraciones. | Hoja de ruta; no presentarlos como implementados. |

## Evidencia de pruebas

- Suite completa: 288 pruebas aprobadas, incluidos 21 casos del nuevo acceso/validación y 6 del respaldo/restauración.
- Flujo real de handlers con SQLite aislado y almacenamiento de bytes: no se alteraron alumnos ni archivos de producción para probar.
- Restauración del ZIP a SQLite nuevo, comparación de bytes, rechazo de archivo corrupto/ZIP truncado y destino existente.
- Comprobación de tipos y lint de los archivos modificados; build independiente probado con bindings sintéticos, sin despliegue externo.
- El proveedor Supabase se simuló en las pruebas: no se afirma que un proyecto real esté conectado.
- Las pruebas manuales anteriores fueron informadas por el usuario. Esta ronda no declara una nueva inspección automática en navegador de producción.

## Referencias técnicas

- Supabase, configuración general: https://supabase.com/docs/guides/auth/general-configuration
- Supabase, seguridad de contraseñas: https://supabase.com/docs/guides/auth/password-security
- Supabase, claves actuales: https://supabase.com/docs/guides/getting-started/api-keys
- OWASP, sesiones: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- Cloudflare, Vinext/Next.js: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Aviso pendiente de herramientas: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- Parches revisados: GHSA-vcvr-r3jv-pc5j, GHSA-hrr3-gc8f-f4qj y GHSA-68fv-2mgg-jv7q; auditoría completa en la evidencia local de esta revisión.

## Dictamen

Apto para preparar la instalación independiente y continuar el piloto privado. La apertura externa sigue pendiente de conectar servicios, verificar la copia final tras configurar credenciales y restaurarla en el destino productivo y confirmar el contenido docente. No retirar Sites antes de completar esos pasos.


## Verificación del respaldo real recibido

El propietario facilitó backup.json, manifest.json y los 14 objetos binarios. Se reconstruyó un ZIP equivalente con esas piezas; el contenedor ZIP original no estuvo disponible. Todos los tamaños y SHA-256 coinciden con el manifiesto: 14 objetos, 37.933.169 bytes. El verificador completo y la restauración a una carpeta nueva pasaron.

La base restaurada contiene 7 perfiles, 115 registros, 12 registros de archivos y 69 eventos de auditoría. Pasaron las comprobaciones de integridad de SQLite, claves foráneas, referencias y comparación de todos los binarios restaurados. No se modificó producción. La copia no contiene sesiones ni identidades de contraseña: el proveedor real sigue pendiente. Después de crear las credenciales del administrador debe generarse y verificarse otra copia final, conservando el mismo proyecto de autenticación en origen y destino.
