# TUTOSEBAS — Arquitectura

Este documento describe la arquitectura que existe actualmente. No representa una arquitectura futura como si ya estuviera implementada.

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

### Estilos

app/globals.css contiene Tailwind CSS y tokens globales. El diseño de producto utiliza verde bosque, dorado, blanco cálido y colores de estado, de acuerdo con la identidad de TUTOSEBAS.

## Backend

### /api/platform

GET:

- exige identidad;
- inicializa o enlaza el perfil;
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
| create_record | admin | crea recurso, curso, pregunta, simulador, aviso o periodo |
| update_status | admin | cambia flujo editorial |
| submit_work | estudiante habilitado | crea o actualiza una entrega |
| review_work | admin | revisa una entrega |
| report_payment | coordinador | registra comprobante |
| review_payment | admin | aprueba o rechaza; al aprobar suma 30 días al vencimiento vigente de forma idempotente |
| check_practice_answer | estudiante | comprueba una respuesta de práctica sin exponer previamente la clave |
| start_simulator_attempt | estudiante | valida acceso, sortea preguntas y alternativas y crea una sesión protegida |
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

El identificador de usuario es la clave estable de autenticación. El correo se usa para enlazar una invitación o determinar administradores. El nombre recibido se usa solo al crear un perfil nuevo; no reemplaza el nombre académico existente.

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
| course | descripción, plan, lecciones y minutos |
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
