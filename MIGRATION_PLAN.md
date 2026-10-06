# TUTOSEBAS — Plan de migración y traspaso

## Autorización y estado vigentes: 2026-10-06

El propietario pidió iniciar la auditoría final y avanzar con los seis pasos, incluyendo correo/contraseña para fichas registradas. Esa instrucción posterior autoriza correcciones, preparación de exportación/copia privada y pruebas; no volver a solicitar las aprobaciones antiguas para ese trabajo. Se conserva la instrucción maestra original literal como antecedente.

La auditoría y ruta actual están en `AUDITORIA_FINAL.md` y `LANZAMIENTO_6_PASOS.md`; estas secciones posteriores prevalecen sobre los estados históricos que siguen. El código incorpora acceso independiente y respaldo completo. Falta conectar servicios reales, validar/restaurar el respaldo de producción y confirmar contenido, dominio y apertura. No sustituir ni desconectar Sites durante la preparación.

El repositorio personal `saimons15ec/TUTOSEBAS` es privado y la cuenta conectada se verificó. Actualizar el código probado en una copia/rama revisable; datos, binarios privados, sesiones y secretos permanecen fuera de GitHub. `deployment/cloudflare.example.json` no contiene recursos reales. Se debe guardar el ZIP privado en el Drive principal y verificarlo antes del traslado.

Decisión de alcance vigente, 2026-10-03: el propietario autorizó sustituir la generación con IA de esta fase por contenido preparado e importación de bloques por materia y tema, sin API. El plan de IA queda opcional futuro. Se preservan íntegros los avisos de auditoría, exportación y migración de este documento; la función nueva no declara V1 ni autoriza una migración.

Estado: desarrollo previo a V1; copia privada de código y respaldos autorizada, migración independiente no iniciada.

Documento rector: `INSTRUCCION_MAESTRA_TUTOSEBAS.md`. Ese archivo conserva de forma literal la instrucción maestra entregada por el propietario. Este plan la resume para el trabajo cotidiano, pero no la reemplaza.

El propietario autorizó sincronizar el código con el repositorio privado `saimons15ec/TUTOSEBAS` y custodiar respaldos privados en el Drive principal. Esta autorización no inicia la migración, no permite publicar datos privados en GitHub y no reemplaza la auditoría final previa al despliegue independiente.

## Secuencia obligatoria

TUTOSEBAS en Work/Sites
→ V1 estable
→ auditoría
→ aprobación
→ preparación de exportación
→ verificación
→ conexión temporal de GitHub personal
→ confirmación de identidad
→ repositorio privado
→ verificación del repositorio
→ posible desconexión de GitHub de la cuenta empresarial
→ apertura desde ChatGPT personal
→ verificación
→ entorno externo
→ hosting e infraestructura
→ dominio
→ producción.

## Reglas mientras V1 no esté lista

- Mantener el repositorio privado autorizado como copia del código, sin D1, R2, respaldos ni documentos académicos privados.
- No crear repositorios externos adicionales sin autorización.
- No migrar.
- No desmontar ni reconstruir TUTOSEBAS.
- No borrar código, datos, archivos, servicios o configuración.
- No cambiar la arquitectura solo para anticipar la migración.
- Continuar desde el Site y el código existentes.
- Mantener documentación y portabilidad.
- Registrar qué depende de Sites/Work y cómo sustituirlo.

## Fase 0 — Desarrollo hacia V1

Mantener actualizados:

- README.md;
- PROJECT_CONTEXT.md;
- ARCHITECTURE.md;
- DEVELOPMENT_RULES.md;
- MIGRATION_PLAN.md;
- esquema y migraciones;
- lista de módulos y estado;
- pendientes, errores y riesgos.

Antes de cerrar V1 comprobar:

- flujo profesor;
- flujo estudiante;
- autenticación;
- autorización;
- navegación;
- materias;
- banco de preguntas;
- simuladores;
- resultados;
- historial;
- archivos;
- persistencia;
- alcance de IA definido para V1;
- escritorio;
- móvil;
- manejo de errores;
- ausencia de errores críticos conocidos.

Si una función pasa a V1.1 o V2, registrar la decisión.

## Punto de detención — candidata a V1

Cuando el proyecto parezca cumplir los criterios, detenerse antes de iniciar otra función importante y mostrar:

========================================================

TUTOSEBAS — CANDIDATA A V1

El proyecto parece cumplir los criterios definidos para V1.

ANTES DE CONTINUAR:

1. Recomiendo iniciar la AUDITORÍA PREVIA A EXPORTACIÓN.

2. Recuerda que tu GitHub personal puede estar DESCONECTADO actualmente de esta cuenta empresarial.

3. NO necesitas conectarlo todavía.

4. Primero debemos realizar la auditoría.

¿Deseas iniciar la AUDITORÍA V1?

========================================================

No exportar automáticamente. Esperar autorización.

## Fase 1 — Auditoría V1

Después de una respuesta afirmativa, auditar:

1. arquitectura;
2. código;
3. frontend;
4. backend;
5. framework;
6. dependencias;
7. base de datos;
8. almacenamiento;
9. autenticación;
10. autorización;
11. usuarios;
12. datos persistentes;
13. archivos;
14. IA;
15. APIs;
16. variables de entorno;
17. Sites;
18. Work;
19. servicios externos;
20. seguridad;
21. errores conocidos;
22. funciones terminadas;
23. funciones pendientes;
24. dependencias específicas del entorno;
25. riesgos de migración;
26. clasificación A/B/C/D de archivos relevantes.

El informe termina con:

- SE MIGRA;
- NO NECESITA MIGRAR;
- OPCIONAL;
- REQUIERE ADAPTACIÓN.

### Seguridad de la auditoría

Revisar como mínimo:

- autenticación y sesiones;
- autorización por rol, grupo, plan y propiedad;
- separación profesor/estudiante;
- protección de rutas y archivos;
- validación de entrada;
- exposición de datos;
- claves, tokens y variables;
- mensajes de error;
- datos personales;
- dependencias y vulnerabilidades;
- copias de seguridad.

No declarar que la aplicación es totalmente segura. Registrar alcance, pruebas y limitaciones.

### Inventario de datos

Identificar ubicación, volumen, propietario lógico, relaciones y estrategia de exportación para:

- perfiles y administradores;
- estudiantes;
- grupos;
- materias;
- preguntas;
- respuestas;
- simuladores;
- intentos;
- calificaciones;
- resultados;
- historial;
- estadísticas;
- pagos;
- planes;
- plantillas plan_template y configuración de permisos/correcciones por grupo;
- periodos;
- trabajos;
- revisiones;
- recursos;
- archivos;
- notificaciones;
- configuraciones;
- contenido generado;
- datos usados por IA.

Para los planes, conservar los IDs canónicos plan-template:bronce/plata/gold, sus featureOverrides, reviewLimit y revision, además de featureOverrides, reviewLimit, accessPolicyVersion y accessRevision en cada grupo. Una sustitución del backend debe mantener la precedencia grupo → plan → permisos previos → base/mínimo de contenido, la vigencia de las configuraciones gestionadas y las escrituras concurrentes protegidas. No convertir una habilitación de módulo en un rol administrativo. Validar catálogo, descarga, progreso, práctica, inicio/finalización y trabajos con el mismo contrato; no eliminar archivos/historial al revocar acceso.

La migración de identidad debe conservar el padrón de correos y la vinculación estable: solo una coincidencia normalizada exacta permite enlazar un perfil; los desconocidos no reciben alta automática, y las suspensiones no se revierten al iniciar sesión. No reasignar silenciosamente auth_id. La audiencia privada externa de Sites y el padrón interno son controles separados; registrar una cuenta no crea una invitación externa. Estas dependencias deben inventariarse antes de sustituir el proveedor y probarse con cuentas aisladas.

Ubicaciones posibles:

- código;
- D1;
- R2;
- Sites;
- Work;
- servicio externo;
- otro.

### Clasificación de archivos

Para cada archivo relevante:

| Categoría | Significado |
| --- | --- |
| A — Referencia | solo ayudó a comprender requisitos, diseño o contenido |
| B — Información ya incorporada | la parte necesaria ya está en código, datos o configuración |
| C — Dependencia operativa | la aplicación lo necesita para funcionar |
| D — Recurso futuro | conviene conservarlo para contenido, IA o versiones futuras |

Registrar nombre, categoría, uso, ubicación, necesidad de migración y consecuencia de no migrarlo.

Clasificación preliminar, no sustitutiva de la auditoría:

- app/data/quiz.json: C para una instalación nueva y B respecto a preguntas ya sembradas en el D1 vivo;
- objetos cargados en R2 y referenciados desde D1: C;
- migraciones de drizzle: C;
- recursos DOCX en public/downloads: categoría por confirmar, actualmente no referenciados;
- adjuntos históricos de conversaciones: clasificar solo si pueden localizarse y su uso es demostrable.

## Punto de detención — aprobación de auditoría

Después del informe preguntar exactamente:

¿Apruebas la auditoría de TUTOSEBAS V1 y deseas preparar la exportación?

No preparar la exportación sin aprobación explícita.

## Fase 2 — Preparación de exportación

Crear una copia independiente sin alterar el Site activo. Debe incluir, según corresponda:

- código fuente;
- frontend y backend;
- package.json y lockfile;
- assets necesarios;
- esquema;
- migraciones;
- scripts;
- .gitignore;
- .env.example;
- README.md;
- PROJECT_CONTEXT.md;
- ARCHITECTURE.md;
- MIGRATION_PLAN.md;
- DEVELOPMENT_RULES.md;
- instrucciones de instalación, ejecución, build y despliegue;
- exportación de datos autorizada;
- exportación de archivos autorizada;
- manifiestos y conteos para verificar.

No incluir:

- secretos;
- tokens;
- contraseñas;
- claves privadas;
- archivos temporales;
- cachés;
- credenciales de Sites;
- datos personales innecesarios.

## Fase 3 — Verificación antes de GitHub

Sin alterar el Site:

- verificar archivos esenciales;
- instalar dependencias en una copia limpia cuando sea posible;
- ejecutar build;
- aplicar migraciones a una base de prueba;
- comprobar .gitignore y .env.example;
- buscar secretos y datos personales;
- verificar archivos grandes;
- comprobar que código, datos y archivos estén diferenciados;
- documentar elementos no exportables;
- comprobar las dependencias de Sites;
- comparar conteos de datos y archivos;
- registrar cualquier adaptación pendiente.

Solo después continuar.

## Punto de detención — conectar GitHub personal

Mostrar:

========================================================

TUTOSEBAS V1 ESTÁ PREPARADA PARA RESPALDO EN GITHUB.

Ahora conecta temporalmente TU CUENTA PERSONAL DE GITHUB
a esta cuenta de ChatGPT.

Ruta aproximada:

ChatGPT
→ Configuración
→ Complementos
→ GitHub
→ conectar tu cuenta personal.

Cuando la hayas conectado, vuelve aquí y dime:

"GITHUB PERSONAL CONECTADO".

NO continúes hasta recibir esa confirmación.

========================================================

No pedir contraseña ni token manual si la integración autorizada es suficiente.

## Fase 4 — GitHub personal

Después de recibir GITHUB PERSONAL CONECTADO:

1. verificar la cuenta GitHub disponible;
2. mostrar usuario o identificador no secreto;
3. pedir confirmación de que es la cuenta personal;
4. no subir nada todavía;
5. pedir nombre definitivo del repositorio;
6. confirmar que será privado;
7. volver a revisar .gitignore, secretos, datos privados y archivos grandes;
8. crear o utilizar el repositorio solo después de aprobación;
9. realizar el primer commit de V1;
10. identificar la versión como TUTOSEBAS V1.0;
11. crear tag o release V1.0 cuando sea apropiado;
12. registrar fecha, commit, estado y funciones.

Nombres sugeridos, sujetos a aprobación:

- tutosebas;
- tutosebas-v1.

El repositorio debe ser privado.

## Fase 5 — Verificación de GitHub

Confirmar que contiene:

- código fuente;
- estructura correcta;
- README;
- PROJECT_CONTEXT;
- ARCHITECTURE;
- MIGRATION_PLAN;
- DEVELOPMENT_RULES;
- dependencias;
- configuración segura;
- .gitignore;
- .env.example;
- scripts;
- esquema y migraciones;
- HANDOFF_TO_CHATGPT.md cuando corresponda.

Confirmar que no contiene secretos. Indicar al propietario qué revisar visualmente en GitHub.

Después mostrar:

TUTOSEBAS V1 ya está respaldada en tu GitHub personal.

Si no deseas mantener tu GitHub personal conectado a esta cuenta empresarial de ChatGPT, ahora puedes desconectarlo desde Configuración → Complementos → GitHub.

Desconectarlo de ChatGPT no elimina el repositorio de tu GitHub.

No desconectar nada automáticamente.

## Fase 6 — Traspaso a ChatGPT personal

Crear HANDOFF_TO_CHATGPT.md con:

- objetivo;
- versión y estado;
- arquitectura;
- documentos que debe leer;
- reglas de seguridad;
- instrucción de no modificar inmediatamente;
- verificación de dependencias;
- funciones existentes;
- pendientes de V1.1/V2;
- control de versiones;
- comandos verificados;
- dependencias de Sites que falten sustituir.

Primer procedimiento en ChatGPT personal:

1. conectar o acceder al repositorio;
2. leer README.md;
3. leer PROJECT_CONTEXT.md;
4. leer ARCHITECTURE.md;
5. leer MIGRATION_PLAN.md;
6. leer HANDOFF_TO_CHATGPT.md;
7. analizar el código;
8. no modificar todavía;
9. presentar un resumen de arquitectura;
10. identificar dependencias faltantes;
11. continuar solo después.

Prueba conceptual:

Si el chat original desaparece, ¿se puede continuar TUTOSEBAS desde GitHub personal y ChatGPT personal?

La respuesta debe ser sí. Si no, identificar y completar información, código, datos, archivos, configuración o documentación faltante.

## Fase 7 — Adaptación externa

No asumir que GitHub es producción.

Evaluar y autorizar separadamente:

- hosting;
- runtime;
- base de datos;
- almacenamiento;
- autenticación;
- autorización;
- proveedor de IA;
- copias de seguridad;
- observabilidad;
- correo;
- dominio;
- DNS;
- SSL;
- privacidad y cumplimiento;
- recuperación ante incidentes.

### Sustituciones previstas

| Sites/Work actual | Necesidad externa |
| --- | --- |
| Sign in with ChatGPT y cabeceras | proveedor OIDC/OAuth y sesiones |
| política de audiencia | control de acceso del hosting o aplicación |
| D1 administrado | D1 propio o base elegida |
| R2 administrado | R2 propio o almacenamiento compatible |
| repositorio interno | GitHub personal privado |
| despliegue de Sites | CI/CD y hosting |
| dominio de Sites | dominio propio, DNS y TLS |
| variables de Sites | gestor de secretos |

La opción de menor fricción técnica probablemente será mantener Cloudflare Workers, D1 y R2 bajo una cuenta propia y sustituir Sites y autenticación. Esta es una hipótesis para evaluar, no una decisión aprobada.

## Fase 8 — Producción

Antes de producción:

- restaurar datos y archivos en un entorno de ensayo;
- verificar relaciones y conteos;
- probar todos los roles;
- probar móvil y escritorio;
- probar copias y restauración;
- configurar monitoreo;
- ejecutar revisión de seguridad;
- preparar reversión;
- mantener Sites intacto hasta que el propietario decida lo contrario.

No comprar, contratar o conectar servicios sin autorización.

## Versionado futuro

Después de V1.0:

- V1.1;
- V1.2;
- V1.x;
- V2.0.

Usar control de versiones para comparar y, cuando sea posible, revertir cambios. Las migraciones de datos deben acompañar los cambios de código que las requieran.

## Riesgos principales de migración

- copiar código sin D1 ni R2;
- perder identidad estable de usuarios al cambiar autenticación;
- incluir datos personales o secretos en Git;
- romper enlaces entre D1 y objetos R2;
- creer que el repositorio interno de Sites es el GitHub personal;
- no disponer de un reemplazo para rutas de ingreso/salida;
- aplicar semillas sobre datos reales;
- desplegar antes de comprobar migraciones;
- retirar Sites demasiado pronto;
- describir funciones parciales como completas.

## Regla final

GitHub será primero una copia privada y nueva fuente de control. Sites permanece intacto hasta que el propietario solicite expresamente retirarlo o modificar su función.

## Inventario añadido: Recursos y Cursos (2026-10-04)

La portabilidad debe conservar los registros course, course_lesson y course_progress, sus relaciones por ID, periodo, revisión y propietario, además de file_objects y objetos R2. Los progresos son datos privados; no se incorporan al repositorio de código. No se añade otro servicio ni API de IA. Una sustitución futura de D1 debe mantener la publicación y reordenación atómicas, el avance idempotente por estudiante/lección y los permisos heredados del curso en catálogo y descarga. La descarga de audio es actual; reproducción en la página sigue pendiente. Esta actualización de inventario no autoriza migración, exportación ni cambio de audiencia.


### Presentación de recursos (2026-10-04)

La reorganización de la biblioteca cambia nombres y componentes, sin migración de datos: se conservan curriculum/courses/apa/other. Una futura exportación debe mantener la relación por kind entre cursos, lecciones y materiales complementarios; el nombre visible no sustituye la clave persistida. Las referencias académicas siguen usando el mismo registro y archivo, con publicación desde la materia original.

### Secciones administrables de recursos (2026-10-04)

La configuración de la biblioteca incorpora planning y secciones personalizadas section_UUID sin alterar las claves existentes. Conservar en un futuro respaldo los registros resource_section, incluidos los retirados: son configuraciones por periodo con nombre, modo, orden y revisión, y los archivados impiden que reaparezca una sección inicial. Las claves category/additionalCategory son relaciones por ID estable, no nombres. El retiro es reversible y mueve contenido en una escritura atómica; su restauración no repatría materiales. Debe conservarse la publicación, plan, archivos y progreso por estudiante, así como el bloqueo de escrituras a destinos retirados. Los periodos anteriores no se reescriben. No se incorpora API externa ni se ejecuta migración o exportación.

## Conservación de versiones académicas

Incluir materialRevision y materialVersions en el inventario/exportación futura, además de todos los binarios R2 anteriores. Conservar el ID del material y la relación sourceResourceId con preguntas. Mantener la transición atómica a borrador/revisión cuando se sustituye contenido y conservar las instantáneas de intentos. Ninguna sustitución autoriza borrar archivos previos.

La edición de estudiantes debe conservar la identidad externa y exigir comparación de la ficha original y restricciones de pertenencia/cupo/coordinador durante la escritura. No reasignar intentos ni archivos al cambiar de grupo.

### Mejora 3: Requisitos de acceso

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: Alta de estudiantes, Configuración e ingreso muestran dos requisitos independientes mediante AccessRequirements. El registro y la autorización externa se explican por separado; no se consulta ni modifica la audiencia automáticamente.

### Mejora 4: Beneficios efectivos del estudiante

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: Mi plan y pagos incluye Tus beneficios actuales con las 16 opciones y su estado efectivo. PlanBenefits usa canUsePlanFeature y el catálogo actualizado, con herencia, excepciones y vencimiento; explica el mínimo del contenido y permisos individuales.

### Mejora 5: Vista previa por grupo

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: En modo Estudiante del profesor, el selector permite Gold de muestra o un grupo guardado. buildGroupPreview filtra publicación, periodo y permisos con la política compartida; excluye historia privada y progreso. El banco para simular se separa del banco visible de práctica. Las entregas, pagos y avance quedan deshabilitados; el grupo y beneficios reflejan la selección.

### Mejora 6: Conservar navegación

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: La navegación valida rutas según el rol, admite Atrás/Adelante y recuerda materia, tema y paso por usuario, área y periodo en sessionStorage; solo guarda selecciones de navegación.

### Mejora 7: Cambios sin guardar

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: Registro temporal de borradores por formulario, aviso al cancelar o salir, guardia de navegación y beforeunload. Los diálogos detectan campos y adjuntos; planes, avisos, entregas y pagos registran su estado. Guardar limpia únicamente ese ámbito. No persiste contenido del borrador.

### Mejora 8: Guardado y doble clic

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: Los botones con acciones asíncronas indican Procesando y bloquean clics concurrentes; los POST del panel comparten una sola operación para cuerpos equivalentes mientras están pendientes. Un fallo libera el bloqueo para reintentar.

### Mejora 9: Gestión de periodos

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: Crear periodo valida años consecutivos y lo deja en preparación. Activar cambia la selección de forma atómica con revisión, conserva contenidos e intentos y exige confirmación descriptiva. Materias, referencias, temas y cobertura de exámenes filtran por convocatoria; las altas usan el periodo vigente y condiciones SQL impiden altas durante un cambio concurrente. No se activa ninguna convocatoria real durante las pruebas.

### Mejora 10: Motivos de rechazo de pagos

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: Rechazar abre un formulario de motivo obligatorio de hasta 1000 caracteres; el servidor valida y conserva autor/fecha. Profesor y coordinador ven la nota junto al pago; los demás integrantes siguen sin recibir comprobantes. Se conserva la revisión definitiva y la renovación idempotente.

### Mejora 11: Cola de tareas

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: La cola abre pagos, revisiones y tareas académicas del periodo vigente separadas por área. Los destinos incluyen materia/tema y examen final; los pasos académicos se sincronizan con la ruta y el historial. Las selecciones se guardan antes del cambio y toleran almacenamiento bloqueado. Los indicadores académicos excluyen periodos anteriores.

### Mejora 12: Menú agrupado

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: El profesor ve Inicio, Gestión académica, Grupos y acceso, Seguimiento y Cuenta; el estudiante ve Inicio, Estudio, Trabajos, Mi grupo, Cuenta y avisos. Un componente compartido mantiene las mismas rutas y avisos en escritorio/móvil, con destino activo accesible y controles de vista de al menos 44 px.

### Mejora 13: Versiones de revisiones

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: Las solicitudes guardan hasta 200 eventos de entrega/revisión con versión, autor, fecha, archivo, notas y plazo, sin truncarlos. Reenviar limpia la corrección actual y conserva la anterior en la cronología. Las revisiones exigen versión actual y CAS; nuevas entregas protegen la solicitud/permisos. Profesor y grupo ven la cronología; archivos históricos y reconciliación validan sus enlaces. El legado conserva solamente la última versión disponible, sin inventar anteriores.

### Mejora 14: Filtros y paginación

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: Estudiantes, grupos, pagos, revisiones, entregas y reportes incorporan búsqueda sin diferencias de acentos, estado/grupo/fechas según el módulo y páginas de 10/20/50 registros. Reportes agrega periodos, resúmenes del filtro y calificaciones finalizadas válidas, preservando los ceros reales. Fechas SQLite se interpretan como UTC y se muestran/filtran en Ecuador. La cola abre los filtros pendientes/activos. El filtrado y las páginas operan sobre los registros autorizados ya cargados.

### Mejora 15: Restaurar materias

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: Gestionar materias permite Restaurar y recuperar contenidos más tarde. Catálogo activo, materiales/simuladores en borrador, preguntas/bloques pendientes; archivos e intentos intactos. Los exámenes recuperan sus cuotas anteriores solo si no se editaron después. Conflictos de temas, revisiones concurrentes y cambios de periodo bloquean la operación. Materias archivadas exigen restauración explícita.

### Mejora 16: Presentación uniforme

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: Botones, entradas, selectores y pestañas tienen área táctil mínima de 44 px. Textos adaptables, ventanas acotadas con desplazamiento, cierres en español y acciones que se ajustan al ancho. Selector de archivos accesible por teclado con formatos, límite de 25 MB y quitar selección. Los grupos conducen a Planes y permisos; la vista previa de cuenta no cierra la sesión real.

### Mejora 17: Editar y archivar avisos

Conservar este comportamiento y sus datos en el futuro traspaso autorizado: Notificaciones reúne creación publicada/borrador, edición, archivo y recuperación como borrador, filtros/paginación y hasta 50 versiones sin truncarlas. Corregir mensaje/destinatario o volver a publicar marca pendiente de lectura. Solo el profesor recibe versiones/lectores anteriores. SQL con revisión y combinación atómica de lecturas evita sobrescrituras; validación de título, mensaje y grupo. El formulario nuevo conserva su borrador al gestionar otro aviso.

### Mejora 18: Exportar reportes

Conservar en el futuro traspaso autorizado: Reportes descarga XLSX real con hojas Estudiantes, Intentos y Filtros: notas numéricas, textos literales, grupo actual e histórico, fecha Ecuador, todas las páginas del filtro, sin claves ni revisión de preguntas. PDF real paginado con tipografía Unicode incrustada, encabezados y pie. Solo se usan los datos autorizados del profesor en su navegador, sin cargas externas. pdf-lib/fontkit se cargan al descargar; fuentes y licencias se conservan. Caracteres que la fuente no cubre muestran error y conservan alternativa Excel. Este reporte no exporta el proyecto ni migra datos.


## Mejora 19: Consulta de documentos y audio — 2026-10-05

ANALIZA: La descarga privada no permitía estudiar PDF, infografías o audio dentro de materiales y lecciones. El visor debe conservar la autorización y permitir adelantar el audio.

CONFIGURA: Ver PDF con páginas renderizadas por PDF.js, Ver imagen y Escuchar audio junto a Descargar, en ambas áreas, recursos y cursos. La apertura comprueba sesión, publicación, plan, grupo y periodo antes de consultar R2. Metadatos y MIME provienen del inventario validado; rangos simples 206/416 e If-Range para audio, cabeceras privadas y nombres seguros. PDF carga solo al abrir, limita páginas y tamaño de lienzo; no usa marcos ni cambia CSP. Word se descarga. Los archivos, datos e historial se conservan.

TESTEA: Cuatro escenarios nuevos, 23 verificaciones específicas y 238 pruebas completas; cinco renderizados de controles, tipos y lint correctos. Revisión visual en navegador pendiente. Sites conserva D1, R2, audiencia, perfiles e historial; no se exporta ni migra el proyecto.


## Mejora 20: Progreso de práctica por tema — 2026-10-05

Conservar los registros practice_session y su titularidad durante el futuro traspaso autorizado, incluidas selecciones, huellas de revisión y respuestas privadas. El destino debe mantener las guardias de identidad, grupo, periodo, plan y preguntas, las respuestas iniciales inmutables y el resumen público sin respuestas/huellas. Esta mejora usa la tabla records existente y no altera migraciones aplicadas.

ANALIZA: La práctica comprobaba las respuestas pero no conservaba el avance. Era necesario distinguir selecciones completas de parciales y evitar contadores duplicados, datos falsificados o progreso de otro integrante.

CONFIGURA: Prácticas privadas en D1 mediante practice_session, asociadas al perfil y grupo, área, materia y periodo. Se registran desde la primera respuesta con selección validada de 1 a 100 preguntas aprobadas. Solo el servidor calcula aciertos; las respuestas iniciales son inmutables e idempotentes. Completa al comprobar toda la selección y repetir inicia otra práctica. Snapshots de preguntas, perfil, grupo, periodo y planes protegen altas y respuestas con SQL/CAS; cambios de contenido exigen una nueva práctica conservando el avance. GET entrega solo resúmenes propios por tema/formato, sin respuestas ni hashes. Tu progreso aparece junto a la selección, se actualiza al comprobar y persiste al recargar. La vista previa no guarda. Simuladores, exámenes y sus notas se conservan.

TESTEA: Siete escenarios API nuevos, 36 verificaciones de práctica/exámenes/temas y 245 pruebas completas; tres renderizados de progreso y controles, tipos y lint correctos. Revisión visual en navegador pendiente. Sites conserva D1, R2, audiencia, perfiles e historial; no se exporta ni migra el proyecto.


## Evidencia adicional de QA — 2026-10-06

Segunda ronda autorizada: 16 escenarios nuevos, 261 pruebas completas, archivos reales y bloques mixtos en ambas áreas; corrección de validación de respuestas de práctica. Confirmación de testeo manual registrada como evidencia del propietario. QA_SECOND_ROUND.md conserva alcance reproducible y límites. Los fixtures de tests son sintéticos y no contienen expedientes personales ni secretos. El paquete de pruebas y su reporte no son exportación del proyecto, D1/R2 ni respaldo de producción. Continúa pendiente validar el contenido académico real; se conserva el punto de detención de candidata a V1 y las autorizaciones separadas para auditoría/exportación.
