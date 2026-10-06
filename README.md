# TUTOSEBAS

Plataforma privada de acompañamiento, preparación, estudio y evaluación para la Unidad de Integración Curricular y el examen de fin de carrera.

Estado actual: piloto privado en ChatGPT Work / Sites. El usuario autorizó la auditoría final y la preparación de los seis pasos de lanzamiento con acceso por correo y contraseña. Las correcciones y el nuevo acceso están implementados y probados de forma aislada; la conexión real del proveedor, el respaldo/restauración de producción, el contenido de apertura y el alojamiento propio siguen pendientes. No se ha declarado terminada la migración ni retirado Sites.

## Auditoría final y ruta de lanzamiento

Lee [AUDITORIA_FINAL.md](AUDITORIA_FINAL.md) y [LANZAMIENTO_6_PASOS.md](LANZAMIENTO_6_PASOS.md). Revisión posterior al piloto v87: **288 pruebas** aprobadas. Dependencias de producción: **0 avisos**; queda un aviso alto sin parche en `braces`, usado por herramientas de compilación/lint y documentado en la auditoría.

El acceso actual conserva ChatGPT y la audiencia privada de Sites. El nuevo modo independiente permite **correo registrado + contraseña inicial del profesor + cambio obligatorio al primer ingreso**. La contraseña se verifica en Supabase Auth, y D1 conserva vínculos/sesiones opacas, no contraseñas. `APP_DEPLOYMENT=independent` requiere `APP_AUTH_MODE=password` y nunca acepta las cabeceras de Sites. No hay registro público ni bootstrap automático de administradores en ese modo.

En **Estudiantes y grupos** está preparada la asignación/restablecimiento de contraseñas; se habilita al conectar el proveedor de forma segura. El profesor debe registrar primero la ficha. El repositorio conserva IDs e historiales; no reasigna identidades antiguas por coincidencia de correo.

En **Configuración → Respaldo privado completo** se descarga un ZIP con las tablas y los archivos originales de R2, comprobados con SHA-256. `scripts/verify-private-backup.py` verifica y restaura en una carpeta nueva. Las pruebas de restauración sintética pasaron; la descarga y restauración del respaldo real aún deben verificarse. No subir ese ZIP, el SQL de datos, secretos ni archivos académicos privados al repositorio.

`deployment/cloudflare.example.json` y `scripts/build-external.mjs` preparan el build de Cloudflare propio, separado del plugin Sites. El build independiente se probó con bindings sintéticos; no crea servicios ni afirma que el proveedor real esté conectado. [HANDOFF_TO_CHATGPT.md](HANDOFF_TO_CHATGPT.md) permite continuar desde la cuenta personal con estos límites claros.

## Objetivo

TUTOSEBAS reúne en un solo lugar la administración académica, el acceso de estudiantes, los contenidos de Fin de Carrera y Complexivos, la práctica con preguntas, los simuladores, los trabajos, las revisiones, los recursos, los planes, los pagos y el seguimiento.

Está diseñado para:

- un profesor o administrador que organiza contenido, grupos, planes y revisiones;
- estudiantes registrados que estudian y practican según su grupo y plan;
- coordinadores de grupo que pueden reportar pagos;
- una futura operación independiente de ChatGPT Sites después de completar y auditar V1.

El objetivo académico es ofrecer una ruta organizada y trazable de preparación, práctica y retroalimentación sin mezclar contenido histórico con el periodo vigente.

## Temas compartidos y bloques mixtos

En el menú del profesor, **Complexivos** y **Fin de Carrera** reúnen la gestión de materias y temas en tres pasos: **Materiales → Preguntas → Simuladores**. La materia permanece seleccionada en los tres; el tema se conserva entre materiales e importación/revisión. Después de importar se abre la revisión del tema correspondiente. Allí aparecen los bloques, **Aprobar todas** y la aprobación individual.

1. En Complexivos o Fin de Carrera selecciona una materia y abre **Gestionar temas**. Crea Tema 1, 2, 3… con número y nombre; el número controla el orden. También puedes crear un tema desde la carga de material o bloque.
2. Elige el tema antes de cargar documentos, infografías, audios o videos. Materiales, bloques y preguntas usan el mismo catálogo y periodo vigente.
3. En **Importar bloque**, la opción **Mixto** ofrece plantillas Word y Excel/CSV con ejemplos de los cinco formatos. Escribe el formato de cada pregunta; la vista previa muestra cantidades por formato y bloquea filas sin formato. Las plantillas individuales siguen disponibles.
4. El estudiante elige materia y tema; **Repasar tema** abre su práctica con ese tema seleccionado. Solo se habilitan los formatos con preguntas aprobadas; si existe uno solo, se selecciona automáticamente. Elige una cantidad disponible, hasta 100, y pulsa **Practicar**. **Volver a practicar** prioriza otras preguntas compatibles cuando quedan disponibles. Los temas sin banco explican qué falta.

Al abrir el administrador, los contenidos vigentes con tema escrito y sin identificador se organizan mediante una operación autorizada del servidor. **Organizar existentes** permite repetirla. Los números repetidos se conservan como temas separados y se señalan para revisar; los nombres originales quedan como alias. Cambiar un número/nombre actualiza el contenido y los filtros del simulador, conservando el identificador, los archivos y las instantáneas de intentos. Los periodos anteriores y los contenidos archivados permanecen intactos. No se activa una API de IA.

## Sorteo por formatos y Recursos adicionales

En **Simuladores**, configura primero las cantidades por tema, materia o bloque. **Reparto por formato** ofrece tres opciones:

- **Variedad y reparto según el banco** incluye al menos una pregunta de cada formato elegido y reparte el resto respetando el banco y las cantidades de cada grupo. Con Todos los formatos se incluyen los que tienen banco aprobado compatible.
- **Cantidades exactas por formato** permite, por ejemplo, 5 de Selección directa y 15 de Completar dentro de 20 preguntas. Usa 0 para excluir un formato; las cantidades deben sumar el total del examen. También funciona con bloques mixtos.
- **Sortear del conjunto permitido** conserva el comportamiento de las configuraciones anteriores.

Se comprueban juntas las cantidades por materia/tema/bloque y formato al publicar, preparar la vista previa e iniciar un intento. Una distribución imposible explica lo que falta; no toma preguntas fuera de la selección. El intento guarda sus preguntas y el reparto aplicado, por lo que una edición posterior no altera su recuperación ni resultado.

El reparto por temas usa el mismo orden natural en la vista previa y el servidor: Tema 1, Tema 2, Tema 10. Así las preguntas restantes se asignan al mismo tema en ambos planes y una combinación válida de cantidades por formato no se rechaza por un orden diferente.

`pnpm test:final-exams` comprueba el endpoint del examen final en ambas áreas con una base SQLite aislada: publicación, selección por materias o bloques, los tres modos de reparto por formato, recuperación del mismo intento, nota sobre 20 e historial sin duplicados. Incluye cantidades inválidas, materias faltantes, bloques de otra área/periodo, banco insuficiente, plan vencido y respuestas malformadas. La finalización exige índices numéricos enteros de 0 a 3; una respuesta vacía no se convierte en la primera alternativa. `pnpm test` ejecuta todas las suites.

**Recursos adicionales** tiene un menú de secciones con explicación y contador. En escritorio se muestra a la izquierda; en pantallas pequeñas se presenta como una cuadrícula compacta. La sección activa reúne su explicación, botón de carga, búsqueda, formato, estado para profesor y materiales.

| Sección | Qué se organiza aquí |
| --- | --- |
| Planificaciones | Modelos de planificación, unidades y formatos de evaluación. |
| Currículos | Documentos curriculares, objetivos, destrezas e indicadores. |
| Cursos por lecciones | Cursos con lecciones ordenadas y avance privado; sus archivos complementarios se muestran en un grupo separado. |
| Normas APA | Guías, plantillas y ejemplos para citas, referencias y trabajos. La guía y revisión orientativa incluidas se despliegan aparte de los archivos del profesor. |
| Biblioteca general | Resúmenes, infografías, audios, presentaciones y otros materiales de consulta. |

El profesor abre **Gestionar secciones → Añadir sección** para crear espacios como Evaluaciones, Infografías o Audios. Elige nombre, descripción y tipo: materiales, cursos con lecciones o materiales y ayuda APA. Puede renombrarlos, cambiar el orden con las flechas y quitarlos. Admite hasta 50 secciones activas del periodo vigente, con nombres únicos. Los estudiantes ven los mismos nombres y orden; la gestión es exclusiva del profesor.

**Quitar sección** la retira del menú de forma reversible. Si tiene contenido, incluidos los archivados y referencias académicas, exige elegir otra sección y mueve todo en una operación. Conserva archivos, publicación, planes y avance; los cursos solo pueden moverse a otra sección de cursos. Los periodos históricos permanecen intactos. **Secciones retiradas → Restaurar** devuelve la sección al menú, sin devolver los contenidos que se movieron. Debe conservarse al menos una sección activa. Los materiales ya guardados como curriculum permanecen en Currículos; para pasarlos a Planificaciones usa **Opciones → Editar**.

**Añadir material** parte de la sección abierta y muestra el nuevo borrador en su destino. En Cursos por lecciones, **Crear curso** crea la ruta con lecciones y **Añadir material de apoyo** carga un archivo de consulta separado. Para añadir una lección se abre **Gestionar curso**.

Cada tarjeta reúne archivo/enlace, publicación y **Opciones**. Este menú permite editar nombre y acceso, sustituir contenido o archivar. Editar o sustituir devuelve a borrador; la sustitución conserva el archivo anterior. No se publica un recurso sin archivo o enlace. **Archivados de esta sección → Restaurar borrador** conserva archivos y permite una nueva revisión.

**Usar material de una materia** usa el mismo recurso vigente, archivo, tema, publicación y plan. **Quitar referencia** solo retira su aparición como apoyo. Los materiales de materias no aparecen automáticamente en Biblioteca general. Su publicación se controla desde la materia original; Opciones permite cambiar la sección de apoyo o quitar la referencia. La ayuda APA no anuncia un curso ficticio: los cursos reales con sus lecciones se publican en Cursos por lecciones. El audio se descarga de forma protegida; la reproducción integrada sigue pendiente.

**Cursos:** Crear curso → Gestionar curso → Materiales → Revisión → Publicación. Cada curso admite hasta 100 lecciones activas, ordenadas y con instrucciones, tipo, archivo o enlace y minutos estimados. Admite documentos, infografías, audios, presentaciones y enlaces de video. Las flechas cambian el orden sin alterar el avance. Se pueden revisar/publicar lecciones individualmente o con **Publicar lecciones pendientes**; la publicación conjunta valida todas las cargas y se cancela completa si un registro cambia. Publicar lecciones no publica el curso: el profesor controla la publicación de la ficha por separado. Un curso necesita una lección publicada o un material/enlace de apoyo. Los cursos conservados sin contenido se mantienen para el profesor y no se ofrecen al estudiante; sus contadores antiguos no crean lecciones.

El estudiante abre **Recursos adicionales → Cursos por lecciones**, accede al material y marca cada lección como completada o pendiente. El avance se guarda por cuenta y persiste al recargar; nunca se comparte con compañeros. La vista previa del profesor no registra avance. Editar una lección la devuelve a borrador y requiere marcar de nuevo su versión revisada; moverla con las flechas conserva su revisión. Ocultar/archivar el curso retira el acceso a sus lecciones. Los enlaces externos dependen también de los permisos del proveedor; los archivos de R2 usan la descarga protegida.

La **Guía para tu prueba manual** aparece al pie de Recursos y cursos, después de la biblioteca. Prueba creación/edición/orden/retiro/restauración de secciones, carga/publicación de un recurso y un curso con dos tipos de material, orden y avance tras actualizar. Usa una cuenta estudiante habilitada y archivos de prueba propios. `pnpm test:resources` incluye las suites de recursos, cursos y secciones con D1/R2 aislados; no modifica datos publicados.

Pendientes para cerrar la validación del uso académico: revisión visual en escritorio/móvil cuando haya navegador de pruebas disponible y revisión del primer banco académico real con el grupo. No se declara candidata a V1.

## Acceso registrado y gestión de planes

El estudiante inicia sesión con ChatGPT usando exactamente el correo registrado por el profesor en **Estudiantes y grupos**. Se normalizan mayúsculas y espacios; no se equiparan alias ni direcciones diferentes. Un correo desconocido recibe **Correo no registrado**, sin crear un perfil ni recibir contenido. El nombre académico se conserva. Una cuenta suspendida no se reactiva al ingresar, y una identidad ya enlazada no puede apropiarse de otro perfil cambiando su correo. El administrador principal conserva el alta controlada mediante `ADMIN_EMAILS`.

La página conserva su audiencia privada de Sites. Para acceder, el correo debe estar autorizado para abrir la URL y registrado dentro de TUTOSEBAS. **Registrar un estudiante no lo añade automáticamente a la audiencia de Sites.** El usuario puede usar **Usar otra cuenta** si inició sesión con un correo equivocado. No se han creado contraseñas propias de TUTOSEBAS.

**Planes y permisos** reúne dos recorridos:

1. **Beneficios de los planes:** abre Bronce, Plata o Gold. Cada plan muestra 16 opciones organizadas en Complexivos, Fin de Carrera, Recursos y cursos y Trabajos UIC. **Base** conserva los valores predeterminados; **Activar opción** o **Desactivar opción** modifica ese beneficio para todos los grupos de ese plan. **Habilitar todas las opciones** prepara todas las activaciones y **Restaurar valores predeterminados** recupera la base. Los cambios se aplican con **Guardar beneficios**. También puedes definir de 0 a 100 correcciones por proyecto.
2. **Activación y permisos por grupo:** selecciona el grupo y su plan. **Usar todos los beneficios del plan** hereda la configuración guardada, sin excepciones anteriores; **Personalizar para este grupo** permite activar, desactivar o heredar cada opción, y definir un límite de correcciones propio. **Guardar permisos del grupo** conserva el plan y sus fechas. Para cambiar el plan o iniciar una nueva vigencia, selecciona de 1 a 365 días y pulsa **Activar plan**: la vigencia empieza desde esa activación. Las renovaciones de pagos siguen su flujo separado.

Los valores predeterminados son:

| Opciones | Bronce | Plata | Gold |
| --- | --- | --- | --- |
| Materiales y práctica de ambas áreas | Incluido | Incluido | Incluido |
| Simulador por materia y examen final de Complexivos | No incluido | Incluido | Incluido |
| Simulador por materia y examen final de Fin de Carrera | No incluido | No incluido | Incluido |
| Planificaciones, Currículos y Biblioteca/secciones de materiales | Incluido | Incluido | Incluido |
| Normas APA y sus materiales | No incluido | Incluido | Incluido |
| Cursos/lecciones y revisor orientativo APA | No incluido | No incluido | Incluido |
| Entregar planificaciones y estudios de caso | No incluido | Incluido | Incluido |
| Correcciones por proyecto, si la entrega está habilitada | 1 | 1 | 3 |

La configuración base también respeta el plan mínimo del contenido. **Activar opción** concede acceso a su contenido publicado aunque tenga un plan mínimo superior. Una excepción del grupo tiene prioridad sobre el beneficio del plan. Los permisos guardados o activados desde esta gestión vencen con el plan, incluso si se habilitan todas las opciones. Los permisos anteriores se conservan hasta que el profesor los sustituya mediante esta gestión; los permisos generales se presentan como opciones editables y los permisos a registros individuales se conservan al guardar en modo personalizado. Volver a los beneficios del plan los retira expresamente.

Las opciones nunca conceden administración, acceso a borradores, periodos históricos ni archivos de otro grupo. Práctica, simulador por materia y examen final son independientes: un simulador puede funcionar sin mostrar el banco de práctica. La API y la descarga de archivos repiten los controles de acceso; ocultar una opción en el menú no es la única protección.

Para una prueba manual, usa un grupo de prueba con una cuenta ya autorizada en Sites y registrada: activa Bronce con su base; personaliza solo Cursos o un simulador; guarda permisos y confirma que la fecha no cambió; revisa el acceso con el estudiante; desactiva esa opción y verifica que el catálogo y la descarga/inicio directo la bloquean. Suspende al estudiante y confirma el bloqueo; vuelve a activarlo explícitamente desde el profesor. No hace falta cambiar la audiencia pública ni usar datos reales adicionales.

`pnpm test:access` ejecuta 13 escenarios de API con D1/R2 aislados: registro, identidad, suspensión concurrente, beneficios globales, excepciones, vencimiento, descargas, cursos/avance, práctica y simuladores de ambas áreas, trabajos/correcciones, validación y escrituras concurrentes. La suite completa suma 178 pruebas aprobadas; además se verificaron ocho escenarios de renderizado estructural de planes/grupos. Estos controles no sustituyen una inspección visual ni prueban el proveedor externo de inicio de sesión.

## Documentos esenciales

Antes de modificar el proyecto, lee en este orden:

1. README.md
2. PROJECT_CONTEXT.md
3. ARCHITECTURE.md
4. DEVELOPMENT_RULES.md
5. MIGRATION_PLAN.md

HANDOFF_TO_CHATGPT.md se generará solamente después de aprobar la auditoría y preparar la exportación de V1.

## Tecnología real

| Capa | Tecnología actual |
| --- | --- |
| Framework | Vinext 1.0.0 beta con APIs compatibles con Next.js 16 |
| Lenguaje | TypeScript 5.9 |
| Interfaz | React 19, Tailwind CSS 4 y componentes Base UI / Shadcn |
| Backend | Rutas de servidor en app/api ejecutadas como Cloudflare Worker |
| Base de datos | Cloudflare D1, compatible con SQLite |
| Acceso a datos | Consultas D1 preparadas; Drizzle mantiene el esquema y las migraciones |
| Archivos | Cloudflare R2 mediante el binding BUCKET |
| Autenticación | Sign in with ChatGPT administrado actualmente por Sites |
| Autorización | Perfil interno, rol, estado, grupo, plan y permisos validados en servidor |
| IA | No hay un proveedor de IA conectado todavía |
| Construcción | Vite, Vinext y scripts del starter de Sites |
| Entorno actual | ChatGPT Sites sobre Cloudflare Workers |
| Control de versiones actual | Repositorio interno de Sites y copia privada autorizada del código en GitHub |

## Estado funcional

La tabla diferencia lo que ya funciona de lo que sigue siendo parcial o futuro.

| Módulo | Estado | Alcance actual |
| --- | --- | --- |
| Acceso | Implementado en Sites | Inicio y cierre con ChatGPT; padrón por correo exacto e identidad vinculada, sin alta automática de desconocidos |
| Panel de profesor | Implementado | Resumen, navegación y vista previa del portal estudiantil |
| Panel de estudiante | Implementado | Inicio, accesos principales, plan, avisos y cuenta |
| Estudiantes | Implementado | Registro por correo, nombre académico, estado y últimos cuatro dígitos de identificación |
| Grupos | Implementado | Creación, código, máximo tres integrantes y un coordinador |
| Planes y permisos | Implementado | Bronce, Plata y Gold con 16 beneficios configurables, valores base, excepciones por grupo, vigencia y correcciones |
| Pagos y renovaciones | Implementado manual | Carga de comprobante y revisión; cada aprobación suma 30 días al vencimiento vigente, sin duplicarse al repetir la acción; no existe pasarela de pago |
| Periodos | Implementado básico | Periodo vigente e histórico separados; administración avanzada pendiente |
| Fin de Carrera | Implementado parcial | Recursos, banco aprobado, examen final por bloques o materias y simulador piloto; faltan contenidos completos de las 23 materias |
| Complexivos | Implementado parcial | Estructura, materias de referencia y simuladores configurables; falta completar contenido y bancos |
| Banco de preguntas | Implementado | Importación Word .docx, PDF con texto, Excel/CSV por bloques y temas, cinco formatos, plantillas por formato, corrección individual, revisión, aprobación conjunta, explicación y fuente |
| Práctica libre | Implementado | Retroalimentación inmediata después de responder |
| Simuladores | Implementado | Práctica por tema/formato/cantidad, simulador con reparto por temas y variedad o cuotas por formato, examen final con cobertura de materias, preguntas aleatorias y alternativas que respetan referencias, recuperación del intento propio activo, nota sobre 20 e historial |
| Intentos y calificaciones | Implementado | Cálculo validado en servidor y almacenamiento de intentos por estudiante |
| Trabajos UIC | Implementado | Planificación y estudio de caso, carga de archivo y versiones |
| Revisiones | Implementado | Estado, plazo, observaciones y archivo corregido |
| Historial | Implementado parcial | Intentos, pagos y revisiones persistentes; falta una vista histórica unificada |
| Recursos | Implementado | Secciones administrables por periodo, búsqueda, filtro por tipo, edición, retiro reversible y referencias a materiales, con publicación y descarga protegidas por plan o permiso |
| Cursos | Implementado | Lecciones ordenadas, materiales mixtos, revisión individual/conjunta, publicación, control por plan y avance privado persistente; contenido real a cargo del profesor |
| Normas APA | Implementado básico | Guías, ejemplos, lista de control y verificador heurístico; no es validación automática completa |
| Notificaciones | Implementado | Avisos internos globales o por grupo y estado de lectura |
| Reportes | Implementado | Resumen general, rendimiento por estudiante e historial individual de intentos con nota, fecha, duración y estado |
| Archivos privados | Implementado | PDF, Word, PowerPoint, PNG, JPG y audios MP3/M4A/WAV/OGG hasta 25 MB en R2 |
| Configuración | Operación y seguridad | Ruta de puesta en marcha, preparación por materia, indicadores de contenido de ensayo, respaldo e inventario |
| IA y automatización | Opcional futura | El alcance vigente usa preguntas preparadas e importación por bloques, sin API. La generación desde material queda conservada en AUTOMATIZACION_ACADEMICA.md para una fase futura |
| Portabilidad | Parcial | Copia privada del código y respaldo privado autorizados; exportación completa y migración requieren sus aprobaciones |

## Cómo funciona

### Flujo del profesor

1. Inicia sesión con la cuenta autorizada.
2. Crea grupos y registra estudiantes.
3. Define coordinador, plan, vigencia y permisos.
4. Publica recursos, cursos, preguntas, simuladores y avisos.
5. Revisa pagos y activa planes.
6. Recibe trabajos, fija plazos, deja observaciones y entrega correcciones.
7. Consulta métricas generales, promedios por estudiante y el detalle de cada intento de simulador.

### Puesta en marcha del primer grupo

Abre Configuración → Puesta en marcha y seguridad. La lista ordena registro, habilitación del correo para abrir la página, plan, material académico, preguntas, simulador y comprobación con estudiante. Registrar el perfil interno no añade automáticamente a la persona a la audiencia de Sites.

La preparación por materia cuenta únicamente el periodo y área elegidos, materiales publicados con archivo o enlace y preguntas aprobadas. Se separan las muestras técnicas conocidas; un simulador publicado con preguntas de ensayo no se presenta como listo para uso académico. El profesor conserva la responsabilidad de revisar el contenido y el acceso.

OPERACION_INICIAL.md contiene la guía del primer grupo y el mantenimiento básico. Por decisión del propietario del 2026-10-03, el alcance vigente prepara preguntas manualmente y las importa por bloques de materia y tema. No requiere API de IA. IMPORTACION_POR_BLOQUES.md explica plantilla, formatos, revisión, duplicados y conexión con el simulador. Subir un PDF de material por sí solo no crea preguntas. La generación desde material queda como mejora opcional futura en AUTOMATIZACION_ACADEMICA.md.

### Flujo del estudiante

1. Inicia sesión con la misma cuenta de ChatGPT cuyo correo registró el profesor.
2. TUTOSEBAS enlaza la identidad sin sustituir el nombre académico registrado.
3. La API filtra contenido según estado, grupo, plan vigente y permisos.
4. El estudiante consulta materiales y practica preguntas.
5. En simuladores responde todas las preguntas antes de finalizar; la nota se calcula de nuevo en el servidor.
6. Los intentos propios quedan en el historial.
7. Según su plan, entrega trabajos y consulta revisiones.
8. El coordinador puede reportar el comprobante de pago del grupo.

### Recuperar un simulador

Si recargas la página, vuelve a la misma materia y abre el simulador. Durante las cuatro horas posteriores al inicio, el servidor recupera el intento propio activo; en la misma pestaña se restauran también las respuestas y la posición guardadas. Cerrar la pestaña o cambiar de dispositivo no conserva ese borrador local. Si el navegador bloquea su almacenamiento, puedes completar el simulador, pero la pantalla indica que debes hacerlo sin recargar. La nota definitiva y el historial se guardan en el servidor al finalizar.

### Relación entre módulos

- El perfil determina rol, estado y grupo.
- El grupo concentra plan, vigencia y permisos.
- Los registros académicos usan un modelo común llamado records.
- Las preguntas aprobadas alimentan práctica y simuladores.
- Los simuladores producen intentos con calificación e historial.
- Los trabajos y pagos enlazan archivos privados guardados en R2.
- Los avisos pueden ser globales o pertenecer a un grupo.

## Estructura del código

| Ruta | Responsabilidad |
| --- | --- |
| app/page.tsx | Entrada, pantalla de acceso y carga del portal autenticado |
| app/platform.tsx | Interfaz principal de profesor y estudiante |
| app/api/platform/route.ts | Lectura del espacio de trabajo y acciones académicas |
| app/api/files/route.ts | Carga y descarga autorizada de archivos |
| app/chatgpt-auth.ts | Adaptador actual de identidad de ChatGPT |
| lib/uic.ts | Contexto, identidad, validaciones, D1/R2 y datos iniciales |
| lib/plans.ts y lib/plans-storage.ts | Beneficios, precedencia, vigencia, validación y persistencia de planes/permisos |
| components/plan-permissions.tsx | Configuración de beneficios por plan y activación/personalización por grupo |
| app/data/quiz.json | Fuente estructurada del banco piloto inicial |
| db/schema.ts | Esquema Drizzle de D1 |
| db/index.ts | Adaptador Drizzle para el binding DB |
| drizzle/ | Migraciones SQL y metadatos |
| components/ui/ | Componentes visuales reutilizables |
| public/ | Favicon y recursos estáticos |
| scripts/ | Instalación, ejecución y construcción |
| .openai/hosting.json | Identificador del Site y bindings lógicos DB/BUCKET |

Consulta ARCHITECTURE.md para el detalle técnico y de datos.

## Base de datos

La base usa cinco tablas:

- profiles: usuarios, identidad, correo, nombre académico, rol, estado, grupo y función dentro del grupo.
- records: entidad flexible para grupos, beneficios de planes, periodos, recursos, cursos, preguntas, simuladores, intentos, trabajos, pagos y avisos.
- file_objects: inventario verificable de cargas R2 con propietario, grupo, tipo, tamaño y SHA-256.
- rate_limits: límites distribuidos por cuenta, acción y ventana.
- security_audit: bitácora append-only de acciones críticas con retención protegida de 365 días.

El campo records.data_json almacena los atributos específicos de cada tipo. Esta decisión acelera V1, pero obliga a validar cuidadosamente cada tipo y puede requerir normalización en una versión futura.

Las migraciones se encuentran en `drizzle/`. Los índices, triggers y la relación lógica entre tipos están documentados en ARCHITECTURE.md.

Importante: el código fuente no contiene los datos vivos. Los perfiles, intentos, pagos y demás registros están en D1; los archivos cargados están en R2. Ambos deben exportarse aparte cuando se autorice la migración.

El administrador puede generar desde Configuración un respaldo lógico de D1 y del inventario R2. Para recuperación total todavía se necesita una copia externa de los binarios; el procedimiento está en OPERATIONS.md.

## Autenticación y permisos

Sites incorpora cabeceras de identidad verificadas. app/chatgpt-auth.ts las convierte en un usuario interno y lib/uic.ts exige primero un correo registrado para enlazar esa identidad con profiles. Un correo desconocido recibe una respuesta no autorizada sin crear un perfil; el alta del administrador configurado es la única inicialización automática.

Roles actuales:

- admin: profesor/administrador con acciones de gestión;
- student: estudiante activo, invitado, pendiente o suspendido;
- coordinator: función de un estudiante dentro de su grupo, no un rol global.

Las decisiones de acceso se repiten en el servidor para evitar depender solo de la interfaz:

- estado activo;
- rol administrador para acciones administrativas;
- pertenencia al grupo;
- plan vigente;
- jerarquía Bronce, Plata y Gold;
- permisos manuales;
- propiedad del intento;
- prefijo del archivo y asociación con el grupo.

No se usa la cédula como contraseña. Solo se conservan, de forma opcional, sus últimos cuatro dígitos.

## Variables y bindings

El archivo .env.example contiene valores seguros de ejemplo.

Variable propia actual:

- ADMIN_EMAILS: lista de correos administradores separada por comas.

Bindings de runtime:

- DB: base de datos D1;
- BUCKET: almacenamiento R2.

DB y BUCKET no son secretos de texto en .env dentro de Sites: son recursos enlazados por el entorno. En una infraestructura externa deberán provisionarse y conectarse explícitamente.

Nunca agregues contraseñas, tokens, claves de API ni credenciales reales al repositorio.

## Decisiones importantes

- Sites sigue siendo el entorno activo hasta que el propietario autorice una migración.
- El nombre académico registrado por el profesor prevalece sobre el nombre de la cuenta de ChatGPT.
- Cada estudiante usa su propia cuenta; un grupo admite máximo tres integrantes.
- Un grupo tiene como máximo un coordinador.
- Las preguntas deben estar aprobadas antes de llegar al estudiante.
- El servidor crea y guarda cada intento, sortea preguntas y alternativas y no entrega la clave al navegador hasta finalizar.
- La práctica libre solicita la corrección al servidor solo después de que el estudiante selecciona una respuesta.
- La calificación usa escala de 0 a 20 y nota mínima configurable, actualmente 14 por defecto.
- Las respuestas y preguntas se aleatorizan en cada intento.
- Los permisos de plan se validan en servidor.
- El rol administrativo efectivo se deriva de `ADMIN_EMAILS` en cada solicitud; un rol antiguo en D1 no conserva privilegios.
- Las mutaciones verifican origen y tamaño, y las cargas validan firma binaria, extensión y contenido activo.
- Los archivos se descargan mediante autorización exacta en D1; los bancos DOCX de referencia ya no se sirven desde `public/`.
- Las cabeceras CSP, HSTS, anti-framing y `nosniff` se aplican a todas las rutas.
- Pagos y renovaciones son manuales; no existe cobro automático. Una aprobación suma 30 días al vencimiento vigente del grupo —o desde la aprobación si ya venció— y repetirla no vuelve a sumar días.
- No se eliminan datos o archivos durante el desarrollo sin autorización expresa.
- Las dependencias actuales de Sites se documentan, no se eliminan prematuramente.

## Pendientes antes de V1

- Completar y validar el contenido académico definido para V1.
- Completar el primer recorrido académico con materiales y preguntas reales; el funcionamiento técnico del simulador y su persistencia ya fueron validados con una cuenta estudiantil en escritorio y móvil.
- Completar los alcances acordados para Fin de Carrera y Complexivos.
- Implementar y verificar la generación desde material en ambas áreas según AUTOMATIZACION_ACADEMICA.md; definir proveedor, modelos, credenciales y límites antes de activar consumo.
- Verificar flujos de profesor, estudiante y coordinador en escritorio y móvil.
- Probar errores, expiración de planes, suspensión y permisos manuales.
- Crear un entorno aislado para el ensayo integral de restauración; el respaldo recuperable, la auditoría persistente y los límites distribuidos ya están configurados.
- Repetir periódicamente la verificación de integridad y completar una restauración integral fuera de producción.
- Auditar archivos y clasificarlos como A, B, C o D.
- Eliminar o sustituir datos personales incrustados antes del futuro respaldo en GitHub.
- Preparar instrucciones externas verificadas; no asumir que una compilación de Sites equivale a un despliegue independiente.

## Ejecutar para desarrollo

Requisitos:

- Node.js 22.13 o superior;
- pnpm 11.25;
- un entorno Cloudflare compatible para D1 y R2;
- Git solo cuando se publique mediante Sites.

Pasos generales:

1. Clonar o abrir el proyecto autorizado.
2. Copiar .env.example a un archivo local no versionado y ajustar ADMIN_EMAILS.
3. Instalar dependencias con pnpm install --frozen-lockfile.
4. Generar o aplicar la migración de drizzle/0000_heavy_pepper_potts.sql a la base local.
5. Ejecutar npm run dev para desarrollo.
6. Ejecutar pnpm test:security, pnpm lint, pnpm exec tsc --noEmit y pnpm audit --prod.
7. Ejecutar npm run build antes de publicar.
8. Ejecutar npm start para probar el Worker ya construido cuando el entorno permita abrir interfaces locales.

El modo de desarrollo actual contiene una identidad administrativa local de respaldo. No debe considerarse un sistema de autenticación para producción externa.

## Despliegue

### Entorno actual

Las publicaciones actuales se hacen exclusivamente al Site existente, conservando su audiencia, D1 y R2. No se crea otro Site para una actualización.

### Fuera de ChatGPT Sites

El despliegue independiente todavía no está autorizado ni completamente adaptado. La ruta prevista es:

1. declarar candidata a V1;
2. auditar código, datos, archivos, seguridad y dependencias;
3. aprobar y preparar una copia independiente;
4. verificar build, migraciones, secretos y documentación;
5. respaldar en un repositorio privado de GitHub personal con autorización;
6. sustituir autenticación de Sites;
7. provisionar D1/R2 o equivalentes;
8. migrar datos y archivos;
9. configurar hosting, dominio, DNS y SSL;
10. realizar pruebas antes de producción.

No ejecutar estos pasos sin seguir MIGRATION_PLAN.md y sus puntos obligatorios de detención.

## Gobierno y portabilidad

DEVELOPMENT_RULES.md contiene la instrucción permanente de desarrollo, documentación, V1, auditoría, exportación, GitHub personal y traspaso. MIGRATION_PLAN.md conserva el procedimiento y los puntos de aprobación.

Mientras V1 no esté lista:

- no exportar;
- no conectar GitHub personal;
- no crear repositorios externos;
- no migrar;
- no desmontar Sites;
- continuar desarrollando desde el estado actual;
- mantener actualizada esta documentación.

## Mejoras aplicadas de forma secuencial

El seguimiento de las 20 mejoras autorizadas está en IMPROVEMENTS.md. Cada una se analiza, implementa y verifica antes de pasar a la siguiente.

En Complexivos o Fin de Carrera → materia → tema → Materiales, **Editar material** permite corregir título, descripción y plan mínimo. **Sustituir el archivo o enlace** guarda la versión anterior y devuelve el material a borrador y sus preguntas vinculadas a revisión. Primero publica el material revisado y luego revisa/aprueba las preguntas. Los intentos anteriores no se alteran. **Versiones anteriores** conserva las descargas para el profesor.

En **Estudiantes y grupos → Editar ficha**, modifica nombre académico, últimos cuatro dígitos, grupo y función. El correo y estado no cambian con la edición. Para sustituir al coordinador, cambia primero al actual a Integrante; después asigna al nuevo. Se preservan cuentas e historial y se respetan los tres cupos del grupo.

### Mejora 3: Requisitos de acceso

Alta de estudiantes, Configuración e ingreso muestran dos requisitos independientes mediante AccessRequirements. El registro y la autorización externa se explican por separado; no se consulta ni modifica la audiencia automáticamente.

### Mejora 4: Beneficios efectivos del estudiante

Mi plan y pagos incluye Tus beneficios actuales con las 16 opciones y su estado efectivo. PlanBenefits usa canUsePlanFeature y el catálogo actualizado, con herencia, excepciones y vencimiento; explica el mínimo del contenido y permisos individuales.

### Mejora 5: Vista previa por grupo

En modo Estudiante del profesor, el selector permite Gold de muestra o un grupo guardado. buildGroupPreview filtra publicación, periodo y permisos con la política compartida; excluye historia privada y progreso. El banco para simular se separa del banco visible de práctica. Las entregas, pagos y avance quedan deshabilitados; el grupo y beneficios reflejan la selección.

### Mejora 6: Conservar navegación

La navegación valida rutas según el rol, admite Atrás/Adelante y recuerda materia, tema y paso por usuario, área y periodo en sessionStorage; solo guarda selecciones de navegación.

### Mejora 7: Cambios sin guardar

Registro temporal de borradores por formulario, aviso al cancelar o salir, guardia de navegación y beforeunload. Los diálogos detectan campos y adjuntos; planes, avisos, entregas y pagos registran su estado. Guardar limpia únicamente ese ámbito. No persiste contenido del borrador.

### Mejora 8: Guardado y doble clic

Los botones con acciones asíncronas indican Procesando y bloquean clics concurrentes; los POST del panel comparten una sola operación para cuerpos equivalentes mientras están pendientes. Un fallo libera el bloqueo para reintentar.

### Mejora 9: Gestión de periodos

Crear periodo valida años consecutivos y lo deja en preparación. Activar cambia la selección de forma atómica con revisión, conserva contenidos e intentos y exige confirmación descriptiva. Materias, referencias, temas y cobertura de exámenes filtran por convocatoria; las altas usan el periodo vigente y condiciones SQL impiden altas durante un cambio concurrente. No se activa ninguna convocatoria real durante las pruebas.

### Mejora 10: Motivos de rechazo de pagos

Rechazar abre un formulario de motivo obligatorio de hasta 1000 caracteres; el servidor valida y conserva autor/fecha. Profesor y coordinador ven la nota junto al pago; los demás integrantes siguen sin recibir comprobantes. Se conserva la revisión definitiva y la renovación idempotente.

### Mejora 11: Cola de tareas

La cola abre pagos, revisiones y tareas académicas del periodo vigente separadas por área. Los destinos incluyen materia/tema y examen final; los pasos académicos se sincronizan con la ruta y el historial. Las selecciones se guardan antes del cambio y toleran almacenamiento bloqueado. Los indicadores académicos excluyen periodos anteriores.

### Mejora 12: Menú agrupado

El profesor ve Inicio, Gestión académica, Grupos y acceso, Seguimiento y Cuenta; el estudiante ve Inicio, Estudio, Trabajos, Mi grupo, Cuenta y avisos. Un componente compartido mantiene las mismas rutas y avisos en escritorio/móvil, con destino activo accesible y controles de vista de al menos 44 px.

### Mejora 13: Versiones de revisiones

Las solicitudes guardan hasta 200 eventos de entrega/revisión con versión, autor, fecha, archivo, notas y plazo, sin truncarlos. Reenviar limpia la corrección actual y conserva la anterior en la cronología. Las revisiones exigen versión actual y CAS; nuevas entregas protegen la solicitud/permisos. Profesor y grupo ven la cronología; archivos históricos y reconciliación validan sus enlaces. El legado conserva solamente la última versión disponible, sin inventar anteriores.

### Mejora 14: Filtros y paginación

Estudiantes, grupos, pagos, revisiones, entregas y reportes incorporan búsqueda sin diferencias de acentos, estado/grupo/fechas según el módulo y páginas de 10/20/50 registros. Reportes agrega periodos, resúmenes del filtro y calificaciones finalizadas válidas, preservando los ceros reales. Fechas SQLite se interpretan como UTC y se muestran/filtran en Ecuador. La cola abre los filtros pendientes/activos. El filtrado y las páginas operan sobre los registros autorizados ya cargados.

### Mejora 15: Restaurar materias

Gestionar materias permite Restaurar y recuperar contenidos más tarde. Catálogo activo, materiales/simuladores en borrador, preguntas/bloques pendientes; archivos e intentos intactos. Los exámenes recuperan sus cuotas anteriores solo si no se editaron después. Conflictos de temas, revisiones concurrentes y cambios de periodo bloquean la operación. Materias archivadas exigen restauración explícita.

### Mejora 16: Presentación uniforme

Botones, entradas, selectores y pestañas tienen área táctil mínima de 44 px. Textos adaptables, ventanas acotadas con desplazamiento, cierres en español y acciones que se ajustan al ancho. Selector de archivos accesible por teclado con formatos, límite de 25 MB y quitar selección. Los grupos conducen a Planes y permisos; la vista previa de cuenta no cierra la sesión real.

### Mejora 17: Editar y archivar avisos

Notificaciones reúne creación publicada/borrador, edición, archivo y recuperación como borrador, filtros/paginación y hasta 50 versiones sin truncarlas. Corregir mensaje/destinatario o volver a publicar marca pendiente de lectura. Solo el profesor recibe versiones/lectores anteriores. SQL con revisión y combinación atómica de lecturas evita sobrescrituras; validación de título, mensaje y grupo. El formulario nuevo conserva su borrador al gestionar otro aviso.

### Mejora 18: Exportar reportes

Reportes descarga XLSX real con hojas Estudiantes, Intentos y Filtros: notas numéricas, textos literales, grupo actual e histórico, fecha Ecuador, todas las páginas del filtro, sin claves ni revisión de preguntas. PDF real paginado con tipografía Unicode incrustada, encabezados y pie. Solo se usan los datos autorizados del profesor en su navegador, sin cargas externas. pdf-lib/fontkit se cargan al descargar; fuentes y licencias se conservan. Caracteres que la fuente no cubre muestran error y conservan alternativa Excel. Este reporte no exporta el proyecto ni migra datos.


## Mejora 19: Consulta de documentos y audio — 2026-10-05

ANALIZA: La descarga privada no permitía estudiar PDF, infografías o audio dentro de materiales y lecciones. El visor debe conservar la autorización y permitir adelantar el audio.

CONFIGURA: Ver PDF con páginas renderizadas por PDF.js, Ver imagen y Escuchar audio junto a Descargar, en ambas áreas, recursos y cursos. La apertura comprueba sesión, publicación, plan, grupo y periodo antes de consultar R2. Metadatos y MIME provienen del inventario validado; rangos simples 206/416 e If-Range para audio, cabeceras privadas y nombres seguros. PDF carga solo al abrir, limita páginas y tamaño de lienzo; no usa marcos ni cambia CSP. Word se descarga. Los archivos, datos e historial se conservan.

TESTEA: Cuatro escenarios nuevos, 23 verificaciones específicas y 238 pruebas completas; cinco renderizados de controles, tipos y lint correctos. Revisión visual en navegador pendiente. Sites conserva D1, R2, audiencia, perfiles e historial; no se exporta ni migra el proyecto.


## Mejora 20: Progreso de práctica por tema — 2026-10-05

Uso: en Fin de Carrera o Complexivos, abre una materia y entra en Práctica. Selecciona tema, formato disponible y cantidad. Tu progreso muestra prácticas completadas, preguntas respondidas y porcentaje de aciertos para esa selección del periodo vigente. Una respuesta comprobada se guarda aunque no termines toda la selección; una práctica parcial no cuenta como completada. Repetir inicia una práctica distinta. No se altera la calificación de simuladores o exámenes.

ANALIZA: La práctica comprobaba las respuestas pero no conservaba el avance. Era necesario distinguir selecciones completas de parciales y evitar contadores duplicados, datos falsificados o progreso de otro integrante.

CONFIGURA: Prácticas privadas en D1 mediante practice_session, asociadas al perfil y grupo, área, materia y periodo. Se registran desde la primera respuesta con selección validada de 1 a 100 preguntas aprobadas. Solo el servidor calcula aciertos; las respuestas iniciales son inmutables e idempotentes. Completa al comprobar toda la selección y repetir inicia otra práctica. Snapshots de preguntas, perfil, grupo, periodo y planes protegen altas y respuestas con SQL/CAS; cambios de contenido exigen una nueva práctica conservando el avance. GET entrega solo resúmenes propios por tema/formato, sin respuestas ni hashes. Tu progreso aparece junto a la selección, se actualiza al comprobar y persiste al recargar. La vista previa no guarda. Simuladores, exámenes y sus notas se conservan.

TESTEA: Siete escenarios API nuevos, 36 verificaciones de práctica/exámenes/temas y 245 pruebas completas; tres renderizados de progreso y controles, tipos y lint correctos. Revisión visual en navegador pendiente. Sites conserva D1, R2, audiencia, perfiles e historial; no se exporta ni migra el proyecto.


## Segunda ronda completa de pruebas — 2026-10-06

ANALIZA: el propietario confirmó su testeo manual y pidió archivos reales y preguntas. CONFIGURA: 28 fixtures y 80 preguntas en cuatro bloques mixtos, ensayos aislados para ambas áreas y corrección de respuestas vacías interpretadas como A. TESTEA: 16 escenarios nuevos y 261 pruebas completas aprobados, tipos y lint correctos; publicación exige compilación válida. Véase QA_SECOND_ROUND.md para matriz, límites y reproducción. Word/PDF/Excel/CSV/TXT son formas alternativas del mismo bloque: importar una sola para evitar duplicados. La práctica solo acepta índices numéricos enteros 0–3. La UI manual fue confirmada por el propietario; esta nueva ronda automatizada no ejecutó navegador ni creó datos en producción.
