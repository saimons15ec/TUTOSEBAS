# TUTOSEBAS — Arquitectura

Este documento describe la arquitectura que existe actualmente. No representa una arquitectura futura como si ya estuviera implementada.

## Adaptación de acceso implementada, pendiente de conexión

`lib/application-auth.ts` selecciona el método de identidad. El default `sites` conserva `app/chatgpt-auth.ts`. En `password`, `lib/password-auth.ts` verifica contraseña contra Supabase Auth y resuelve una sesión opaca por su SHA-256 en D1; ignora cabeceras Sites. El modo independiente no acepta el método `sites`.

Tablas nuevas: `auth_identities` (vínculo explícito perfil/identidad externa, correo registrado, estado, versión de credenciales y cambio inicial) y `auth_sessions` (digest, perfil, versión y vencimientos). `profiles.auth_id` conserva la identidad histórica. Los IDs académicos y `created_by` no se reescriben. No se almacena contraseña, access token ni refresh token del proveedor.

`/api/auth` permite login/logout, cambio propio y asignación solo por administrador a fichas existentes. El primer acceso es restringido hasta cambiar contraseña; el resto de APIs sigue usando `context()` y sus políticas. Suspender o resetear revoca sesiones; el contexto vuelve a verificar estado, correo y versión. El proveedor se probó con un adaptador de HTTP simulado; falta su conexión real.

`/api/security/backup/full` genera un ZIP privado por streaming: snapshot de tablas, binarios de R2 y manifiesto. Valida bytes/hashes; no incluye sesiones ni secretos. `scripts/verify-private-backup.py` valida CRC/SHA-256 y restaura SQLite/objetos en carpeta nueva; no modifica producción. El lector de DB nativo no es una alternativa al respaldo porque puede truncar valores.

El build independiente (`scripts/build-external.mjs`) usa una configuración de Cloudflare propia y excluye `sites()` en Vite. El ejemplo no despliega ni proporciona IDs reales; secretos se configuran en runtime. La publicación normal por Sites conserva su identidad, bindings y audiencia. La adaptación no elimina por sí sola el control exterior de Sites.

## Resumen

TUTOSEBAS es una aplicación full-stack TypeScript construida con Vinext, React y APIs compatibles con Next.js. Se compila como Cloudflare Worker y actualmente se despliega mediante ChatGPT Sites.

Flujo principal:

1. Sites autentica al visitante y añade cabeceras de identidad.
2. La página del servidor decide si muestra acceso o el portal.
3. El cliente consulta /api/platform.
4. El servidor crea o enlaza el perfil en D1.
5. El servidor filtra datos por rol, estado, grupo, plan y permisos.
6. Las acciones escriben en D1.
7. Los archivos se guardan o leen en R2 a través de /api/files.

## Frontend

### Entrada

app/page.tsx es una ruta dinámica. Si no hay identidad muestra la pantalla de ingreso; si existe, renderiza Platform.

### Portal

app/platform.tsx contiene la interfaz cliente y los módulos principales. Actualmente está concentrado en un archivo para velocidad de desarrollo. Antes o después de V1 puede dividirse por dominio si esa refactorización reduce riesgo y se verifica sin cambiar comportamiento.

Responsabilidades principales:

- carga del espacio de trabajo;
- mutaciones JSON a /api/platform;
- cargas binarias a /api/files con nombre, tipo y alcance validados en servidor;
- navegación profesor/estudiante;
- formularios y diálogos;
- práctica y simulador;
- estados de carga, error y acceso pendiente;
- interfaz responsive.

### Componentes

components/ui contiene primitivas de interfaz reutilizadas: botones, diálogos, pestañas, campos, progreso, hojas móviles, etiquetas y notificaciones.

components/operational-setup.tsx incorpora en Configuración la ruta de primer uso y la preparación por materia. lib/operations.ts deriva indicadores del Workspace ya autorizado: periodo y área exactos, materiales publicados con archivo o enlace, preguntas aprobadas, cantidades de simulador y vigencia de grupos. Separa muestras técnicas identificadas explícitamente o por los títulos y temas de las pruebas conocidas; no clasifica cualquier uso académico de la palabra «prueba» como demostración. Es una lectura de estado: no cambia permisos de Sites, publica registros, archiva contenido ni reemplaza la revisión académica.

La ruta vigente prepara contenidos y preguntas fuera de la plataforma e importa bloques de preguntas por materia y tema, sin API de IA. Los indicadores describen registros reales; la calidad académica y el acceso requieren comprobación del profesor. La generación desde material queda opcional futura por decisión del propietario del 2026-10-03.

### Estilos

app/globals.css contiene Tailwind CSS y tokens globales. El diseño de producto utiliza verde bosque, dorado, blanco cálido y colores de estado, de acuerdo con la identidad de TUTOSEBAS.

## Backend

### /api/platform

GET:

- exige identidad;
- exige el correo del padrón y enlaza su identidad; solo inicializa automáticamente al administrador configurado;
- devuelve estado de autorización;
- para administrador devuelve todos los registros y perfiles;
- para estudiante devuelve contenido publicado/aprobado, su grupo, entregas/pagos del grupo y sus intentos;
- aplica después un filtro de plan y permisos a recursos, cursos, preguntas y simuladores.

POST acepta acciones explícitas:

| Acción | Actor | Resultado |
| --- | --- | --- |
| create_group | admin | crea grupo |
| invite_student | admin | crea o actualiza estudiante |
| set_user_status | admin | activa o suspende |
| activate_plan | admin | configura plan, vigencia y permisos |
| save_plan_template | admin activo | guarda los beneficios y correcciones de Bronce, Plata o Gold para sus grupos |
| save_group_permissions | admin activo | guarda herencia o excepciones del grupo sin modificar su plan ni vigencia |
| create_record | admin | crea recurso, curso, pregunta, simulador, aviso o periodo |
| update_status | admin | cambia flujo editorial |
| update_additional_resource | admin activo | edita metadatos de apoyo general, conserva adjuntos y vuelve a borrador |
| set_additional_reference | admin activo | clasifica o quita una referencia a un material vigente sin copiar ni archivar el original |
| submit_work | estudiante habilitado | crea o actualiza una entrega |
| review_work | admin | revisa una entrega |
| report_payment | coordinador | registra comprobante |
| review_payment | admin | aprueba o rechaza; al aprobar suma 30 días al vencimiento vigente de forma idempotente |
| check_practice_answer | estudiante | comprueba una respuesta de práctica sin exponer previamente la clave |
| start_simulator_attempt | estudiante | valida acceso, recupera la sesión propia activa o sortea preguntas y alternativas para crear una sesión protegida |
| finish_simulator_attempt | estudiante | califica la sesión guardada y registra el resultado de forma idempotente |
| mark_notice | usuario autorizado | marca un aviso como leído |

Las entradas se recortan y validan. Las consultas usan parámetros preparados. Los identificadores y la selección exacta de cada intento se guardan en D1 antes de enviarse al navegador.

### /api/files

POST:

- exige perfil activo;
- admite PDF, Word, PowerPoint, PNG y JPG;
- limita el tamaño a 25 MB;
- restringe tipos de carga por rol;
- incorpora tipo, grupo, mes y UUID en la clave;
- guarda metadatos de autor y nombre original en R2.

GET:

- exige perfil activo;
- rechaza claves vacías o con recorrido de directorios;
- concede acceso administrativo total;
- para estudiantes limita por grupo;
- para material compartido vuelve a comprobar publicación, plan y permisos;
- entrega con caché privada breve.

## Autenticación

app/chatgpt-auth.ts lee:

- oai-authenticated-user-id;
- oai-authenticated-user-email;
- oai-authenticated-user-full-name;
- oai-authenticated-user-full-name-encoding.

El identificador de usuario es la clave estable de autenticación. Cada solicitud exige que su correo normalizado coincida primero con el padrón; después comprueba y enlaza el identificador estable. No hay búsqueda alternativa por auth_id que conserve acceso tras cambiar a un correo no registrado. Un correo desconocido devuelve el estado virtual unregistered, sin persistir un perfil ni ejecutar semillas. Solo el administrador configurado en ADMIN_EMAILS puede inicializar su perfil.

Una identidad diferente no puede reenlazar un perfil existente, y una identidad ya vinculada a otro perfil no puede adquirir una invitación cambiando su correo. La asociación utiliza una actualización condicionada al correo, auth_id, rol y estado leídos; si una suspensión concurre con el ingreso, se rechaza la actualización. Una invitación válida pasa a active; suspended permanece bloqueado. El nombre de ChatGPT no reemplaza el nombre académico existente.

Las rutas reservadas de ingreso, salida y callback son propiedad de Sites.

### Dependencia específica

Fuera de Sites esas cabeceras no existirán. La migración necesita un proveedor de identidad que:

- autentique al usuario;
- entregue un identificador estable y correo verificado;
- proteja sesiones;
- implemente ingreso, salida y callback;
- mantenga el contrato interno ChatGPTUser o introduzca un adaptador equivalente.

Opciones futuras, a evaluar en la auditoría: Auth.js con un proveedor OAuth/OIDC, Clerk, Auth0, Supabase Auth o un servicio OIDC propio. No se ha elegido ninguno.

## Autorización

La autorización se compone de:

1. audiencia externa del Site;
2. identidad autenticada;
3. perfil interno;
4. estado activo;
5. rol admin o student;
6. pertenencia a grupo;
7. función coordinator o member;
8. plan y vencimiento;
9. permisos manuales;
10. propiedad o asociación del registro/archivo.

La interfaz oculta acciones no disponibles, pero la API vuelve a verificarlas. La audiencia de Sites no sustituye la autorización interna.

### Beneficios y excepciones de planes

lib/plans.ts define 16 permisos de estudiante y la base Bronce/Plata/Gold. lib/plans-storage.ts almacena plantillas publicadas de kind plan_template, con IDs canónicos plan-template:bronce/plata/gold en records. Son configuración global, independiente del periodo académico; la lectura usa la base si no existe una plantilla y no crea registros. No se cambió el esquema ni se reescribieron datos vivos para introducir esta función.

La decisión compartida canUsePlanFeature aplica: vigencia obligatoria en grupos administrados con accessPolicyVersion=1; excepción allow/deny del grupo; excepción del plan; permisos anteriores conservados; y base más plan mínimo del contenido. Un allow explícito requiere plan vigente y supera el mínimo del contenido de ese módulo. No supera estado editorial, periodo, pertenencia ni rol. Los permisos anteriores generales se convierten en opciones al editar; guardar personalizado conserva permisos por registro, y seleccionar la herencia del plan elimina las excepciones expresamente. Los grupos aún no gestionados conservan su compatibilidad previa hasta que el profesor guarde o active sus opciones.

Cada grupo conserva featureOverrides, reviewLimit opcional, accessPolicyVersion y accessRevision. Las plantillas conservan featureOverrides, reviewLimit y revision. Los formularios envían la revisión leída y las escrituras comparan el snapshot JSON exacto; una edición concurrente devuelve 409 sin sobrescribir otro cambio. Las aprobaciones de pagos también renuevan accessRevision. save_group_permissions conserva plan y fechas; activate_plan establece la vigencia desde la activación, acepta de 1 a 365 días y hereda o aplica las opciones seleccionadas. Los permisos no aceptan capacidades administrativas ni atributos arbitrarios.

GET del catálogo, comprobación de práctica, inicio/finalización del simulador, descargas R2, progreso de lecciones y entregas usan la misma política. Los simuladores pueden acceder al banco aprobado en servidor aunque la práctica esté deshabilitada. Las lecciones heredan el permiso del curso. Las secciones personalizadas se clasifican por su modo; las referencias académicas conservan el permiso original. Los trabajos distinguen planificación/estudio de caso y aplican el límite grupo → plan → base; se preservan las entregas/archivos históricos al retirar acceso a nuevas entregas. El catálogo estudiantil excluye los registros administrativos de plantillas.

components/plan-permissions.tsx reúne beneficios desplegables de los tres planes y un segundo recorrido para grupos. La interfaz estudiantil refleja el catálogo recibido; los controles del servidor siguen siendo la autoridad. tests/plans-access-api.test.mjs comprueba los endpoints reales con SQLite/R2 aislados, sin datos ni sesiones de producción.

## Persistencia

### D1

Binding lógico: DB.

D1 contiene cinco tablas: dos de dominio y tres controles de seguridad separados.

#### profiles

| Campo | Uso |
| --- | --- |
| id | identificador interno |
| auth_id | identificador estable del proveedor de identidad |
| email | correo único |
| full_name | nombre académico |
| role | admin o student |
| status | invited, pending, active o suspended |
| identifier_last4 | últimos cuatro dígitos opcionales |
| group_id | grupo lógico |
| member_role | member o coordinator |
| created_at | auditoría temporal |
| updated_at | auditoría temporal |

Índices:

- único por email;
- único por auth_id;
- por group_id;
- compuesto por status y role.

#### records

| Campo | Uso |
| --- | --- |
| id | identificador estable |
| kind | tipo de entidad |
| group_id | alcance de grupo, cuando aplica |
| title | título visible |
| status | estado editorial u operativo |
| data_json | atributos específicos del tipo |
| created_by | perfil creador |
| created_at | creación |
| updated_at | modificación |

Índices:

- kind y status;
- group_id y kind;
- updated_at.

#### file_objects

Inventario de cada carga nueva en R2: clave exacta, tipo, grupo, propietario, nombres, MIME, tamaño, estado y huella SHA-256. La escritura R2 se revierte si este registro no puede crearse.

#### rate_limits

Contadores distribuidos por sujeto, acción y ventana. La clave se deriva con SHA-256 y los registros mayores de siete días se limpian automáticamente.

#### security_audit

Eventos administrativos, financieros, académicos sensibles y de archivos. Dos triggers impiden actualizar eventos y eliminarlos durante el periodo de retención de 365 días.

### Tipos de records

| kind | Datos principales |
| --- | --- |
| group | código, plan, estado, inicio, vencimiento, permisos |
| period | actual/histórico y nota |
| resource | área, categoría, descripción, plan, periodo, materia, archivo |
| course | ficha, descripción, plan, periodo y apoyo opcional; contadores de lecciones/minutos se calculan desde sus lecciones reales |
| course_lesson | courseId, periodo, orden, duración, descripción, tipo, archivo/enlace y revisión; borrador/publicado/archivado |
| course_progress | courseId, lessonId, revisión completada, estado y fecha; propietario created_by y estado private |
| question | área, materia, tema, periodo, formato, dificultad, enunciado, opciones, clave, explicación, fuente |
| simulator | área, materia, periodo, tipo, cantidad, plan, nota mínima |
| attempt | simulador, respuestas, nota, aprobación, duración y estudiante |
| submission | tipo de trabajo, notas, archivos, revisiones y observaciones |
| payment | plan, valor, comprobante y revisión |
| notice | mensaje, grupo y lista de lectores |

### Relaciones

No hay claves foráneas declaradas. Las relaciones son lógicas:

- profiles.group_id apunta a un record de kind group;
- records.group_id apunta a un grupo;
- records.created_by apunta a profiles.id;
- attempt.data_json.simulatorId apunta a un simulator;
- archivos se enlazan mediante claves R2 dentro de data_json.
- file_objects.object_key identifica la misma clave exacta de R2 y permite verificar propietario, grupo e integridad declarada.

La vista administrativa de reportes enlaza cada `attempt.created_by` con `profiles.id` y cada `attempt.group_id` con el registro de grupo. Con esas relaciones calcula, sin duplicar datos, el promedio, la mejor nota, el resultado más reciente y el historial individual. Si un perfil ya no estuviera disponible, conserva como respaldo el nombre académico guardado en `attempt.data_json.studentName`.

Esta flexibilidad simplifica V1, pero la auditoría debe revisar integridad y la conveniencia de claves foráneas o tablas normalizadas para versiones futuras.

### Migraciones

db/schema.ts define el esquema con Drizzle. `0000_heavy_pepper_potts.sql` crea las tablas de dominio y `0001_confused_union_jack.sql` incorpora inventario de archivos, límites distribuidos y auditoría inmutable. El despliegue de Sites aplica las migraciones incluidas.

Una migración independiente debe:

- conservar orden y versión;
- exportar primero los datos vivos;
- probar importación en una base vacía;
- comprobar conteos, identificadores y enlaces;
- no asumir que ejecutar el seed recrea información real.

## Almacenamiento

Binding lógico: BUCKET.

Patrones de claves:

- materials/shared/año-mes/uuid-nombre;
- reviews/grupo/año-mes/uuid-nombre;
- submissions/grupo/año-mes/uuid-nombre;
- payments/grupo/año-mes/uuid-nombre.

R2 conserva el binario y metadatos básicos. D1 conserva la referencia académica y, para cargas nuevas, un registro `file_objects` con SHA-256. La migración debe exportar ambos y verificar que cada clave referenciada exista.

La interfaz envía el archivo como cuerpo binario y coloca únicamente nombre, tipo de operación y grupo autorizado en la solicitud. Este formato evita dependencias del parser multipart en navegadores móviles. La ruta valida identidad, rol, grupo, tipo MIME y tamaño antes de escribir en R2; una respuesta no JSON se trata como sesión vencida o fallo de transporte y nunca se muestra como un error técnico de análisis.

## Datos iniciales

lib/uic.ts crea de manera idempotente:

- periodos actual e histórico;
- recursos y cursos de muestra/base;
- simuladores iniciales;
- banco piloto a partir de app/data/quiz.json;
- simulador piloto de Educación Física.

El seed solo se ejecuta con contexto administrativo, salvo el simulador piloto que puede asegurarse con cualquier perfil si existe un administrador activo.

Los datos iniciales no sustituyen una copia de D1.

## Calificación del simulador

Al iniciar, el servidor:

- comprueba simulador publicado, periodo vigente, grupo, plan y permisos;
- selecciona exclusivamente preguntas aprobadas de D1 según la distribución configurada;
- aleatoriza preguntas y alternativas;
- guarda la sesión exacta como `attempt_session`, incluida la clave que permanece solo en D1;
- devuelve al navegador el enunciado y las alternativas sin `correctIndex`, explicación ni fuente de corrección.

Al finalizar, el navegador envía únicamente el identificador de la sesión y las alternativas seleccionadas. El servidor comprueba propiedad, grupo, vigencia, simulador y totalidad de respuestas; compara contra la sesión guardada, calcula `score = correctas / total × 20` y registra un único `attempt` mediante un identificador derivado de la sesión. Solo entonces devuelve la corrección y las explicaciones.

Las preguntas entregadas por el endpoint general tampoco contienen la clave para estudiantes. La práctica libre solicita la corrección al servidor después de cada selección.

Al reabrir un simulador, la API busca un `attempt_session` en curso del mismo estudiante, grupo y simulador. Verifica acceso actual y vencimiento de cuatro horas antes de devolver el mismo cuestionario sin clave. La sesión completada se conserva para la finalización idempotente; una sesión vencida se marca como tal al volver a solicitarla y nunca permite una nueva calificación.

El navegador guarda únicamente las alternativas elegidas y la posición en `sessionStorage`, bajo una clave por intento. Este borrador pertenece a la pestaña y no reemplaza D1: no contiene claves de corrección, explicaciones, nombres ni correo. Las respuestas restauradas deben corresponder a preguntas del intento y ser índices numéricos válidos. El límite de lectura de 64 000 caracteres admite los exámenes combinados de hasta 345 preguntas. Lectura, escritura y limpieza local toleran excepciones del navegador; nunca ocultan un resultado ya guardado por el servidor. Si el guardado local falla, la interfaz informa que recargar no conservará las respuestas.

## Variables y recursos

### Variable propia

| Nombre | Secreto | Uso |
| --- | --- | --- |
| ADMIN_EMAILS | No, pero contiene datos personales | lista separada por comas de administradores |

### Variables estándar o de herramientas

NODE_ENV y las variables de scripts de Wrangler/Vinext son administradas por el entorno. No deben confundirse con configuración funcional.

### Bindings

| Binding | Tipo | Uso |
| --- | --- | --- |
| DB | D1Database | perfiles y registros |
| BUCKET | R2Bucket | archivos privados |

## Servicios externos actuales

- ChatGPT Sites: registro, publicación, acceso y URL.
- Sign in with ChatGPT: identidad.
- Cloudflare Workers: ejecución.
- Cloudflare D1: datos.
- Cloudflare R2: archivos.

No existen actualmente:

- pasarela de pagos;
- correo transaccional;
- proveedor de IA;
- analítica externa;
- almacenamiento externo adicional.

## Construcción y despliegue actual

package.json expone:

- npm run dev;
- npm run build;
- npm start;
- npm run db:generate;
- npm run lint.
- pnpm test:security.

La publicación actual:

1. construye el Worker;
2. confirma el código fuente exacto en el repositorio interno de Sites;
3. empaqueta dist;
4. guarda una versión de Sites;
5. despliega esa versión conservando la audiencia personalizada.

.openai/hosting.json contiene únicamente project_id y bindings lógicos. No debe almacenar secretos.

## Dependencias específicas de Sites/Work

| Función | Dependencia actual | Servicio recibido | Sustitución futura |
| --- | --- | --- | --- |
| Inicio de sesión | rutas y cabeceras de Sites | OAuth, sesión e identidad | proveedor OIDC/OAuth y adaptador |
| Audiencia | política de acceso de Sites | propietario y visitantes permitidos | reglas del hosting, proxy o aplicación |
| Base de datos | binding D1 administrado | recurso y conexión | D1 propio o base compatible |
| Archivos | binding R2 administrado | bucket y credenciales | R2 propio o almacenamiento S3 compatible |
| Publicación | Sites | build, migraciones y Worker | CI/CD y hosting propios |
| URL/TLS | Sites | dominio de plataforma y HTTPS | dominio, DNS y certificados |
| Repositorio | repositorio interno | historial para publicar | GitHub personal privado |

## Riesgos técnicos conocidos

- app/platform.tsx concentra demasiadas responsabilidades.
- records.data_json requiere validaciones rigurosas y dificulta integridad relacional.
- el modo de desarrollo usa una identidad administrativa local genérica; no sirve como autenticación externa.
- existe una suite negativa enfocada en seguridad, pero aún falta cobertura funcional integral de extremo a extremo.
- no hay proveedor de IA conectado.
- las mutaciones actuales verifican origen y contexto; el modelo de sesión deberá revisarse al sustituir Sites.
- los archivos y datos vivos no se incluyen al copiar solo el repositorio.
- los DOCX de referencia se conservan fuera de `public/` y no forman parte del contenido servido.
- todavía faltan respaldo recuperable de D1/R2, auditoría persistente, límite distribuido de frecuencia y un entorno de pruebas separado.

## Principio de portabilidad

Mientras se desarrolla en Sites:

- encapsular dependencias del entorno;
- no introducir rutas temporales en lógica funcional;
- no guardar secretos en el código;
- mantener esquema y migraciones;
- documentar cada dependencia no portable;
- conservar instrucciones de reconstrucción;
- no degradar la aplicación activa para anticipar una migración no autorizada.

## Importación de preguntas por bloques

- components/question-block-import.tsx contiene la carga, vista previa, corrección individual y revisión conjunta.
- lib/question-blocks.ts valida contexto, cinco formatos, límites, claves y duplicados por enunciado y contexto.
- lib/question-block-file.ts lee Word .docx, PDF con texto, Excel .xlsx y CSV/TSV/TXT; valida ZIP, tamaño real descomprimido, macros y objetos incrustados antes de leer la primera hoja o word/document.xml. lib/question-document.ts conserva párrafos y tablas con etiquetas explícitas; lib/question-pdf-browser.ts usa un worker PDF.js incluido en el sitio y lib/question-pdf.ts extrae solo texto con límites de páginas y tamaño, sin IA ni OCR.
- lib/question-block-storage.ts guarda records.kind=question_block y sus preguntas en un batch D1 transaccional, con identificadores deterministas y reintentos sin copias. No añade tablas ni cambia autenticación.
- Las acciones import_question_block, approve_question_block y update_question requieren administrador activo y origen confiable. El servidor valida otra vez los datos; nunca confía solo en la vista previa.
- Solo preguntas approved entran en práctica o simulador. Los registros question_block no se entregan al estudiante.
- El simulador individual puede guardar topics como lista de temas o [] para todos. Publicación, sorteo y vista previa respetan ese filtro. El examen final conserva distribución por materias completas y añade selectionMode=blocks, con blockDistribution por importBlockId: hasta 30 bloques, 1–100 preguntas por bloque y 200 en total. lib/final-exam-block-storage.ts obtiene materia y título de D1 en tres consultas y rechaza bloques de otra área, periodo o materia archivada; lib/final-exam-blocks.ts comparte filtros parametrizados entre publicación y sorteo, con límites de cantidad y sesión de 1,5 MB.
- prepareQuestionChoices conserva referencias a letras u orden y recalcula la clave cuando mezcla alternativas. Los intentos guardados conservan sus instantáneas.
- tests/question-blocks.test.ts verifica CSV, Excel real, entradas dañadas, permisos, transacciones, concurrencia, claves y filtro SQL de temas.

- tests/question-documents.test.ts prueba DOCX y PDF reales, las claves explícitas, los cinco formatos, tablas, listas, escaneos y límites. La verificación visual del nuevo diálogo queda pendiente cuando no hay navegador de pruebas disponible.


## Selección académica y plantillas por formato

- lib/question-templates.ts genera instrucciones, ejemplos y CSV por cada formato; lib/question-word-template.ts recibe el formato y el contexto de materia/tema. El lector y la validación siguen conservando el formato explícito de cada pregunta, incluso en bloques mixtos.
- components/topic-practice.tsx configura tema, formato y cantidad; lib/academic-selection.ts filtra el banco por estado, área, materia, periodo, tema y formato, omite identificadores repetidos y limita la muestra a 1–100. La comprobación de cada respuesta sigue en check_practice_answer y no expone claves antes de responder.
- Los simuladores guardan formats=[] para todos o una lista validada. topicCoverage=balanced implica cuotas por cada tema del banco aprobado; pool conserva el sorteo anterior. lib/academic-selection-storage.ts agrupa el banco en D1 y lib/academic-selection.ts asigna el total sin superar capacidades. simulador por materia: 5–100; examen nuevo por materias/bloques: 1–100 por entrada y 200 en total.
- coverAllSubjects=true verifica el catálogo activo al publicar y crear intentos nuevos. La cobertura completa propone todas las materias en configuraciones nuevas; no modifica registros ni intentos anteriores. Los exámenes por bloque resuelven sus materias desde D1.
- Publicación, sorteo y vista previa comparten filtros de formatos y cuotas de temas. Las instantáneas incluyen formatos, reparto por temas y cobertura junto a las preguntas y claves privadas. Los indicadores de lib/operations.ts comprueban esas restricciones antes de marcar una materia preparada.

## Catálogo compartido de temas

- `records.kind=topic` almacena área, materia, periodo, número (1–999), nombre (hasta 150 caracteres), alias y marca de revisión. El identificador permanece estable al cambiar nombre u orden. No se añade una tabla ni se modifica autenticación.
- `lib/academic-topics.ts` comparte orden, alcance, alias y reconocimiento entre materiales, preguntas, bloques y práctica. `topicId` es autoritativo dentro de su alcance; los nombres previos permiten compatibilidad de contenido sin identificador.
- `lib/academic-topics-storage.ts` crea con INSERT condicionado para evitar números simultáneos duplicados, organiza los registros vigentes y actualiza nombres/configuraciones sin reemplazar campos independientes editados simultáneamente. Renombrar usa comparación de la versión leída y un batch transaccional; se limita a 500 cambios asociados por operación. La organización inicial se procesa en lotes reintentables de 80 escrituras.
- `sync_academic_topics` y `save_academic_topic` exigen administrador activo y origen confiable, tienen límites de frecuencia y dejan auditoría. GET sigue siendo una lectura. El cliente administrativo solicita la organización inicial por POST; no se modifica contenido histórico, archivado ni instantáneas de intentos.
- Las cargas validan que tema y material de origen pertenezcan a la misma área, materia y periodo. Quitar una materia archiva también sus registros topic.
- `components/academic-topics.tsx` contiene selector, creación, edición y navegación. Materiales ofrecen Repasar tema; `components/topic-practice.tsx` comparte el catálogo y muestra disponibilidad aunque el tema no tenga preguntas aprobadas.
- Mixto es una modalidad de plantilla, no un sexto formato de pregunta. Guarda `requireExplicitFormat=true`, requiere el formato por fila y conserva Caso práctico, listas, alternativas y claves. Los bloques nuevos usan el topicId en su identidad de reintento; cambiar el nombre no crea otra importación.
- `tests/academic-topics.test.ts` prueba los mismos SQL de D1 con SQLite, incluidas escrituras fallidas/concurrentes, conservación, temas ambiguos y la selección de un simulador renombrado. La revisión visual del nuevo flujo permanece pendiente.
- Los indicadores de operación reconocen los nombres de muestras técnicas después de añadir el número del tema; un tema académico como Pruebas de germinación sigue contando como contenido real.

## Reparto conjunto por formatos

`lib/academic-format-distribution.ts` valida `formatCoverage=pool|varied|quota` y `formatDistribution=[{format,count}]`. La configuración antigua sin modo usa pool. La configuración nueva propone varied. Quota admite 1–200 por entrada, formatos únicos permitidos y suma igual al total; la interfaz usa 0 para omitir una entrada.

`planFormatRequirements` usa capacidades formato → grupo (tema/materia/bloque) y cantidades de cada grupo. Quota resuelve un flujo exacto; varied garantiza al menos una de cada estructura seleccionada, aumentando techos de manera equilibrada hasta cubrir el total o rechazar una combinación imposible. Las celdas elegibles son disjuntas dentro de las distribuciones normalizadas; no se repiten preguntas en un intento. No exige que cada tema tenga cada formato.

D1 cuenta por formato con el mismo `simulatorQuestionQuery`, que añade parámetros de formato a los filtros de estado aprobado, área, periodo, materia y bloque/tema. `resolveAcademicRequirements` comparte el plan entre publicación y sorteo; `planAcademicRequirementsFromRows` lo usa en vista previa e indicadores. Las sesiones guardan cuotas configuradas y reparto resuelto; los intentos finalizados conservan esos metadatos junto a su instantánea. La recuperación anterior al nuevo sorteo se mantiene.

`tests/academic-formats.test.ts` comprueba capacidades cruzadas, matrices pequeñas contra una búsqueda exhaustiva, bancos escasos/imposibles, compatibilidad, SQL real por tema/bloque/materia, equivalencia de vista previa y servidor y ausencia de IDs repetidos.

## Recursos adicionales organizados

`lib/additional-resources.ts` define secciones iniciales planning/curriculum/courses/apa/other y tipos compartidos. `resourceSections` aplica configuración por periodo e incluye claves personalizadas section_UUID; los registros archivados actúan como tombstones para no volver a mostrar una sección inicial retirada. Course usa courses por compatibilidad o una sección personalizada de modo courses; resource de area=resources usa su category o el fallback other. Material académico solo aparece aquí si tiene `additionalCategory` válido. Se usa el mismo registro, nunca una copia del archivo. El catálogo filtra periodo vigente y archivados; contenido heredado sin periodo mantiene compatibilidad. Búsqueda compara título, descripción, materia/tema y nombre de sección, ignorando acentos.

`lib/resource-sections-storage.ts` persiste kind=resource_section en records, con ID determinista resource-section:period:sectionId y datos de nombre normalizado, descripción, modo, orden y revisión. No requiere migración. GET no inicializa registros: solo el primer cambio administrativo siembra los cinco valores iniciales, sin restaurar tombstones. El servidor fija el periodo vigente y valida administrador activo, nombres únicos, máximo 50 secciones y al menos una activa. save/move/archive/restore tienen límites de frecuencia y auditoría. El modo se conserva al editar. `components/resource-sections.tsx` ofrece creación, edición, flechas, retiro con destino y restauración; el contexto del catálogo proporciona secciones activas a los formularios de carga, edición y referencias. Profesor y estudiante comparten configuración y orden; el catálogo estudiante recibe también tombstones del periodo para aplicar la ocultación.

Retirar una sección mueve registros vigentes o heredados, incluidos archivados y referencias académicas, en una sola sentencia UPDATE con instantáneas materializadas de contenido y configuraciones. Cambios concurrentes en origen/destino o nuevos contenidos cancelan toda la operación. Solo se actualiza category o additionalCategory; archivos, publicación, plan, cursos, lecciones y progreso se conservan. Cursos requieren destino de modo courses. Restaurar no repatría contenido. Los periodos anteriores permanecen intactos. Creación, edición, sustitución, referencia y publicación de contenido revalidan la sección activa dentro de la sentencia de escritura para cerrar carreras con el retiro. El snapshot máximo es 900 KB; para catálogos mayores se pide mover contenidos previamente desde Opciones.

`ADDITIONAL_LABELS` y `ADDITIONAL_SECTIONS` asignan nombres, propósito y ejemplos a las mismas claves persistidas. `components/additional-resources.tsx` ofrece navegación compartida por secciones, acciones de creación contextual mediante renderActions, búsqueda por recurso/curso/lección, tipo, estado para profesor, limpieza, edición, sustitución de archivo/enlace, archivo/restauración y referencia. La categoría elegida se conserva al cargar y se muestra el destino del nuevo recurso. AdditionalResourceCard reúne tipo, descripción, contexto, archivo y publicación en la misma tarjeta. ResourceOptions agrupa metadatos, sustitución y archivo en un Popover; los diálogos controlados se montan fuera de su contenido y devuelven el foco al botón de opciones al cerrar. Los archivos académicos enlazados se publican desde su materia; la biblioteca solo controla la referencia. Los archivados se muestran en su sección. La guía manual queda al pie. `components/courses.tsx` reúne la ficha, lecciones ordenadas, revisión/publicación y consumo con avance privado. Normas APA mantiene archivos y su asistente orientativo dentro de un desplegable separado; se retira la ficha estática que anunciaba un curso sin contenido. Los cursos y archivos de category=courses se agrupan por kind, sin modificar registros. El audio sigue como descarga protegida.

`updateAdditionalResource` y `setAdditionalResourceReference` requieren administrador activo también en almacenamiento. Edición general modifica solo título/description/category/plan y vuelve a draft; archivo/enlace, periodo y datos del curso se conservan. Referencia cambia únicamente additionalCategory de una materia vigente, sin modificar plan, publicación o preguntas vinculadas. Actualizaciones con JSON/status cambiados concurrentemente fallan con 409. Las acciones se limitan por ventana y auditan IDs/categoría, sin secretos.

Creación general normaliza una lista explícita de campos, fija periodo vigente y draft, exige enlaces HTTP(S) sin usuario/contraseña y verifica adjuntos del profesor contra registro y R2. El audio requiere una extensión de audio; el upload ya comprueba tipo, firma y límite de 25 MB. La publicación vuelve a validar metadatos y adjunto. La descarga directa aplica el mismo límite de periodo vigente que el catálogo antes de comprobar plan y permisos.

`tests/additional-resources.test.ts` comprueba clasificación heredada, ausencia de duplicados académicos, categorías/tipos/URLs, permisos, conservación de archivos/preguntas/intentos, concurrencia, recursos archivados/históricos y el límite de periodo. `tests/resource-sections-api.test.mjs` ejecuta el API real sobre SQLite/R2 aislados para probar creación, nombres, orden, retiros/restauración, historia, adjuntos y avance privado; incluye escrituras concurrentes, acceso estudiante, destinos retirados, límites y bypasses de estado. La compilación y pruebas automáticas no sustituyen la revisión visual pendiente de escritorio y móvil.

### Cursos y límites de acceso

`lib/courses-storage.ts` usa la tabla records existente, sin migración ni reemplazo de datos. Las acciones save_course_lesson, set_course_lesson_status, move_course_lesson y publish_course_lessons requieren administrador activo y periodo vigente. Una lección no puede cambiar de curso; solo se aceptan campos normalizados. Los adjuntos nuevos deben estar registrados y pertenecer al profesor que los cargó. Orden admite enteros 1–1000, duración 0–600 minutos y un máximo de 100 lecciones activas. Archivo/restauración son reversibles y no eliminan objetos. La publicación conjunta y el intercambio de posiciones usan una instantánea materializada en una única sentencia SQLite, evitando publicaciones parciales y escrituras obsoletas. El snapshot conserva el JSON almacenado exacto: json_set puede representar 3 como 3.0 y una reserialización no sirve para comparar versiones.

`lib/content-access.ts` centraliza publicación, periodo, plan activo y concesiones explícitas para recursos/cursos. GET /api/platform añade solo lecciones publicadas del curso accesible y progreso del propietario. Cursos antiguos sin apoyo ni lecciones reales no aparecen al estudiante. GET /api/files acepta una referencia publicada realmente autorizada; una lección hereda el acceso de su curso, no de campos plan/permissions en la lección. Reconciliación del inventario reconoce también course_lesson. Nunca se envía data_json en el catálogo: las claves de preguntas solo se exponen mediante la retroalimentación autorizada, no por una copia del JSON sin filtrar.

set_course_lesson_progress requiere estudiante activo, grupo, curso/lección publicados y permisos vigentes. Un ID determinista por perfil/lección permite guardar repetidamente sin duplicados. created_by fija el propietario; no se aceptan identificadores de usuario/grupo enviados por el cliente. Una revisión nueva invalida la marca anterior para el cálculo de avance, conservando el registro. La vista previa no envía esta acción. Las nuevas acciones tienen límites de frecuencia y auditoría.

`tests/helpers/platform-api.mjs` comparte el puente de ejecución de los endpoints reales con las pruebas de examen final. `tests/resources-courses-api.test.mjs` comprueba materiales mixtos, D1/R2, publicación, avance e idempotencia, privacidad entre compañeros, planes/permisos, descarga directa, archivos falsos/ajenos, límites, origen de petición, revisión obsoleta, restauración, concurrencia y reconciliación. La comprobación visual corresponde al recorrido manual anunciado en la página.

## Edición de material académico

save_academic_material delega en lib/academic-materials-storage.ts y exige administrador activo, periodo vigente, revisión y archivo propio validado. Guarda materialRevision y materialVersions en records, sin migración. Un batch condicionado al snapshot modifica el recurso y devuelve a pending solo preguntas aprobadas con su sourceResourceId, área y periodo. El material pasa a draft; los intentos no se escriben. La respuesta estudiantil excluye materialVersions. components/academic-material-edit.tsx ofrece edición y versiones desde ContentCard.

edit_student usa lib/students-storage.ts y studentRevision: comparación de campos exactos, administrador activo y actualización condicionada a cupos/grupo/coordinador en una sentencia. No acepta cambios de correo/auth_id/rol/estado ni escribe registros históricos. StudentEdit presenta la ficha junto al estado del estudiante.

### Mejora 3: Requisitos de acceso

Alta de estudiantes, Configuración e ingreso muestran dos requisitos independientes mediante AccessRequirements. El registro y la autorización externa se explican por separado; no se consulta ni modifica la audiencia automáticamente. 13 regresiones de acceso y dos renderizados estructurales; tipos/lint aprobados

### Mejora 4: Beneficios efectivos del estudiante

Mi plan y pagos incluye Tus beneficios actuales con las 16 opciones y su estado efectivo. PlanBenefits usa canUsePlanFeature y el catálogo actualizado, con herencia, excepciones y vencimiento; explica el mínimo del contenido y permisos individuales. 13 regresiones de acceso y cuatro escenarios de renderizado; tipos/lint aprobados

### Mejora 5: Vista previa por grupo

En modo Estudiante del profesor, el selector permite Gold de muestra o un grupo guardado. buildGroupPreview filtra publicación, periodo y permisos con la política compartida; excluye historia privada y progreso. El banco para simular se separa del banco visible de práctica. Las entregas, pagos y avance quedan deshabilitados; el grupo y beneficios reflejan la selección. 3 escenarios nuevos y 13 de permisos; tipos/lint aprobados tras corregir el contexto

### Mejora 6: Conservar navegación

La navegación valida rutas según el rol, admite Atrás/Adelante y recuerda materia, tema y paso por usuario, área y periodo en sessionStorage; solo guarda selecciones de navegación. Tres pruebas de rutas, separación de selecciones y almacenamiento bloqueado; tipos y lint correctos.

### Mejora 7: Cambios sin guardar

Registro temporal de borradores por formulario, aviso al cancelar o salir, guardia de navegación y beforeunload. Los diálogos detectan campos y adjuntos; planes, avisos, entregas y pagos registran su estado. Guardar limpia únicamente ese ámbito. No persiste contenido del borrador. Tres pruebas de conservar, descartar, guardar y revertir cambios; tipos y lint correctos.

### Mejora 8: Guardado y doble clic

Los botones con acciones asíncronas indican Procesando y bloquean clics concurrentes; los POST del panel comparten una sola operación para cuerpos equivalentes mientras están pendientes. Un fallo libera el bloqueo para reintentar. Tres pruebas de concurrencia, recuperación y separación de solicitudes; suite completa, tipos y lint correctos.

### Mejora 9: Gestión de periodos

Crear periodo valida años consecutivos y lo deja en preparación. Activar cambia la selección de forma atómica con revisión, conserva contenidos e intentos y exige confirmación descriptiva. Materias, referencias, temas y cobertura de exámenes filtran por convocatoria; las altas usan el periodo vigente y condiciones SQL impiden altas durante un cambio concurrente. No se activa ninguna convocatoria real durante las pruebas. Cuatro escenarios API nuevos y 202 pruebas completas, incluyendo concurrencia, historia, permisos, años y aislamiento; se actualizó el contexto de dos fixtures y se comprobó el catálogo histórico; tipos/lint correctos.

### Mejora 10: Motivos de rechazo de pagos

Rechazar abre un formulario de motivo obligatorio de hasta 1000 caracteres; el servidor valida y conserva autor/fecha. Profesor y coordinador ven la nota junto al pago; los demás integrantes siguen sin recibir comprobantes. Se conserva la revisión definitiva y la renovación idempotente. Tres escenarios API nuevos y 13 regresiones de acceso; rechazos inválidos, privacidad y extensión única de 30 días comprobados; tipos/lint correctos.

### Mejora 11: Cola de tareas

La cola abre pagos, revisiones y tareas académicas del periodo vigente separadas por área. Los destinos incluyen materia/tema y examen final; los pasos académicos se sincronizan con la ruta y el historial. Las selecciones se guardan antes del cambio y toleran almacenamiento bloqueado. Los indicadores académicos excluyen periodos anteriores. Tres escenarios nuevos y 11 regresiones de rutas/gestión académica; destinos, separación temporal y parámetros acotados comprobados; tipos/lint correctos.

### Mejora 12: Menú agrupado

El profesor ve Inicio, Gestión académica, Grupos y acceso, Seguimiento y Cuenta; el estudiante ve Inicio, Estudio, Trabajos, Mi grupo, Cuenta y avisos. Un componente compartido mantiene las mismas rutas y avisos en escritorio/móvil, con destino activo accesible y controles de vista de al menos 44 px. Siete pruebas de navegación/cola y dos renderizados de menú completos; todos los destinos se conservan una sola vez, avisos y aria-current correctos; tipos/lint correctos.

### Mejora 13: Versiones de revisiones

Las solicitudes guardan hasta 200 eventos de entrega/revisión con versión, autor, fecha, archivo, notas y plazo, sin truncarlos. Reenviar limpia la corrección actual y conserva la anterior en la cronología. Las revisiones exigen versión actual y CAS; nuevas entregas protegen la solicitud/permisos. Profesor y grupo ven la cronología; archivos históricos y reconciliación validan sus enlaces. El legado conserva solamente la última versión disponible, sin inventar anteriores. Tres escenarios API nuevos, dos renderizados de cronología y 212 pruebas completas; archivos históricos, aislamiento, límites y concurrencia comprobados; tipos/lint correctos.

### Mejora 14: Filtros y paginación

Estudiantes, grupos, pagos, revisiones, entregas y reportes incorporan búsqueda sin diferencias de acentos, estado/grupo/fechas según el módulo y páginas de 10/20/50 registros. Reportes agrega periodos, resúmenes del filtro y calificaciones finalizadas válidas, preservando los ceros reales. Fechas SQLite se interpretan como UTC y se muestran/filtran en Ecuador. La cola abre los filtros pendientes/activos. El filtrado y las páginas operan sobre los registros autorizados ya cargados. Seis escenarios nuevos de filtros, fechas, páginas y promedios; 13 pruebas de listas/rutas y cuatro renderizados de pantallas; tipos/lint correctos.

### Mejora 15: Restaurar materias

Gestionar materias permite Restaurar y recuperar contenidos más tarde. Catálogo activo, materiales/simuladores en borrador, preguntas/bloques pendientes; archivos e intentos intactos. Los exámenes recuperan sus cuotas anteriores solo si no se editaron después. Conflictos de temas, revisiones concurrentes y cambios de periodo bloquean la operación. Materias archivadas exigen restauración explícita. Seis escenarios API nuevos y 224 pruebas completas: ambas áreas, archivos privados, catálogo solo, legado, conflictos de temas, permisos, concurrencia y periodo; tipos y lint correctos

### Mejora 16: Presentación uniforme

Botones, entradas, selectores y pestañas tienen área táctil mínima de 44 px. Textos adaptables, ventanas acotadas con desplazamiento, cierres en español y acciones que se ajustan al ancho. Selector de archivos accesible por teclado con formatos, límite de 25 MB y quitar selección. Los grupos conducen a Planes y permisos; la vista previa de cuenta no cierra la sesión real. Seis comprobaciones por renderizado y siete regresiones de navegación, borradores y concurrencia; tipos y lint correctos. Evaluación visual en navegador pendiente

### Mejora 17: Editar y archivar avisos

Notificaciones reúne creación publicada/borrador, edición, archivo y recuperación como borrador, filtros/paginación y hasta 50 versiones sin truncarlas. Corregir mensaje/destinatario o volver a publicar marca pendiente de lectura. Solo el profesor recibe versiones/lectores anteriores. SQL con revisión y combinación atómica de lecturas evita sobrescrituras; validación de título, mensaje y grupo. El formulario nuevo conserva su borrador al gestionar otro aviso. Seis escenarios API nuevos, 38 verificaciones de avisos/seguridad y 230 pruebas completas; renderizado de creación, historial, archivo y páginas, tipos/lint correctos

### Mejora 18: Exportar reportes

Reportes descarga XLSX real con hojas Estudiantes, Intentos y Filtros: notas numéricas, textos literales, grupo actual e histórico, fecha Ecuador, todas las páginas del filtro, sin claves ni revisión de preguntas. PDF real paginado con tipografía Unicode incrustada, encabezados y pie. Solo se usan los datos autorizados del profesor en su navegador, sin cargas externas. pdf-lib/fontkit se cargan al descargar; fuentes y licencias se conservan. Caracteres que la fuente no cubre muestran error y conservan alternativa Excel. Este reporte no exporta el proyecto ni migra datos. Cuatro escenarios de exportación, 21 verificaciones de reportes/exámenes reales y 234 pruebas completas; XLSX reabierto con lector independiente, PDF parseado y tres páginas renderizadas e inspeccionadas, controles por renderizado; tipos/lint correctos


## Mejora 19: Consulta de documentos y audio — 2026-10-05

ANALIZA: La descarga privada no permitía estudiar PDF, infografías o audio dentro de materiales y lecciones. El visor debe conservar la autorización y permitir adelantar el audio.

CONFIGURA: Ver PDF con páginas renderizadas por PDF.js, Ver imagen y Escuchar audio junto a Descargar, en ambas áreas, recursos y cursos. La apertura comprueba sesión, publicación, plan, grupo y periodo antes de consultar R2. Metadatos y MIME provienen del inventario validado; rangos simples 206/416 e If-Range para audio, cabeceras privadas y nombres seguros. PDF carga solo al abrir, limita páginas y tamaño de lienzo; no usa marcos ni cambia CSP. Word se descarga. Los archivos, datos e historial se conservan.

TESTEA: Cuatro escenarios nuevos, 23 verificaciones específicas y 238 pruebas completas; cinco renderizados de controles, tipos y lint correctos. Revisión visual en navegador pendiente. Sites conserva D1, R2, audiencia, perfiles e historial; no se exporta ni migra el proyecto.


## Mejora 20: Progreso de práctica por tema — 2026-10-05

ANALIZA: La práctica comprobaba las respuestas pero no conservaba el avance. Era necesario distinguir selecciones completas de parciales y evitar contadores duplicados, datos falsificados o progreso de otro integrante.

CONFIGURA: Prácticas privadas en D1 mediante practice_session, asociadas al perfil y grupo, área, materia y periodo. Se registran desde la primera respuesta con selección validada de 1 a 100 preguntas aprobadas. Solo el servidor calcula aciertos; las respuestas iniciales son inmutables e idempotentes. Completa al comprobar toda la selección y repetir inicia otra práctica. Snapshots de preguntas, perfil, grupo, periodo y planes protegen altas y respuestas con SQL/CAS; cambios de contenido exigen una nueva práctica conservando el avance. GET entrega solo resúmenes propios por tema/formato, sin respuestas ni hashes. Tu progreso aparece junto a la selección, se actualiza al comprobar y persiste al recargar. La vista previa no guarda. Simuladores, exámenes y sus notas se conservan.

TESTEA: Siete escenarios API nuevos, 36 verificaciones de práctica/exámenes/temas y 245 pruebas completas; tres renderizados de progreso y controles, tipos y lint correctos. Revisión visual en navegador pendiente. Sites conserva D1, R2, audiencia, perfiles e historial; no se exporta ni migra el proyecto.


## QA de documentos y respuestas — 2026-10-06

El arnés adicional lee DOCX/PDF/XLSX/CSV/TXT reales con los lectores de la aplicación, usa las migraciones de D1 sobre SQLite aislada y conserva bytes completos en el adaptador R2. Recorre carga→inventario→material→bloque→aprobación→práctica/simulador/final→resultado→reporte; prueba rangos y permisos antes de lectura. 16 escenarios nuevos, 261 pruebas completas. check_practice_answer valida tipo number e índice entero 0–3 antes de consultar o guardar; no convierte null, booleanos o cadenas en respuestas. No cambian esquema, autenticación, bindings, audiencia ni almacenamiento real. Los límites y la distinción entre QA aislada y navegación real están en QA_SECOND_ROUND.md.
