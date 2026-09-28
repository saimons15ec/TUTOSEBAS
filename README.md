# TUTOSEBAS

Plataforma privada de acompañamiento, preparación, estudio y evaluación para la Unidad de Integración Curricular y el examen de fin de carrera.

Estado actual: desarrollo y pruebas dentro de ChatGPT Work / Sites. El proyecto todavía no ha sido declarado candidato a V1 y no está autorizado para exportación, GitHub personal ni migración.

## Objetivo

TUTOSEBAS reúne en un solo lugar la administración académica, el acceso de estudiantes, los contenidos de Fin de Carrera y Complexivos, la práctica con preguntas, los simuladores, los trabajos, las revisiones, los recursos, los planes, los pagos y el seguimiento.

Está diseñado para:

- un profesor o administrador que organiza contenido, grupos, planes y revisiones;
- estudiantes registrados que estudian y practican según su grupo y plan;
- coordinadores de grupo que pueden reportar pagos;
- una futura operación independiente de ChatGPT Sites después de completar y auditar V1.

El objetivo académico es ofrecer una ruta organizada y trazable de preparación, práctica y retroalimentación sin mezclar contenido histórico con el periodo vigente.

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
| Control de versiones actual | Repositorio interno de Sites; no es el GitHub personal del propietario |

## Estado funcional

La tabla diferencia lo que ya funciona de lo que sigue siendo parcial o futuro.

| Módulo | Estado | Alcance actual |
| --- | --- | --- |
| Acceso | Implementado en Sites | Inicio y cierre de sesión con ChatGPT; asociación por identidad y correo |
| Panel de profesor | Implementado | Resumen, navegación y vista previa del portal estudiantil |
| Panel de estudiante | Implementado | Inicio, accesos principales, plan, avisos y cuenta |
| Estudiantes | Implementado | Registro por correo, nombre académico, estado y últimos cuatro dígitos de identificación |
| Grupos | Implementado | Creación, código, máximo tres integrantes y un coordinador |
| Planes y permisos | Implementado básico | Bronce, Plata, Gold, vigencia y habilitaciones manuales |
| Pagos y renovaciones | Implementado manual | Carga de comprobante y revisión; cada aprobación suma 30 días al vencimiento vigente, sin duplicarse al repetir la acción; no existe pasarela de pago |
| Periodos | Implementado básico | Periodo vigente e histórico separados; administración avanzada pendiente |
| Fin de Carrera | Implementado parcial | Recursos, banco aprobado y simulador piloto; faltan contenidos completos de las 23 materias |
| Complexivos | Implementado parcial | Estructura, materias de referencia y simuladores configurables; falta completar contenido y bancos |
| Banco de preguntas | Implementado | Creación manual, revisión, aprobación, reformulación, explicación y fuente |
| Práctica libre | Implementado | Retroalimentación inmediata después de responder |
| Simuladores | Implementado | Preguntas y alternativas aleatorias, navegación, resultado sobre 20, aprobación, revisión e historial |
| Intentos y calificaciones | Implementado | Cálculo validado en servidor y almacenamiento de intentos por estudiante |
| Trabajos UIC | Implementado | Planificación y estudio de caso, carga de archivo y versiones |
| Revisiones | Implementado | Estado, plazo, observaciones y archivo corregido |
| Historial | Implementado parcial | Intentos, pagos y revisiones persistentes; falta una vista histórica unificada |
| Recursos | Implementado | Publicación y descarga protegida por plan o permiso |
| Cursos | Implementado básico | Catálogo y control por plan; lecciones, consumo y progreso completo están pendientes |
| Normas APA | Implementado básico | Guías, ejemplos, lista de control y verificador heurístico; no es validación automática completa |
| Notificaciones | Implementado | Avisos internos globales o por grupo y estado de lectura |
| Reportes | Implementado | Resumen general, rendimiento por estudiante e historial individual de intentos con nota, fecha, duración y estado |
| Archivos privados | Implementado | PDF, Word, PowerPoint, PNG y JPG hasta 25 MB en R2 |
| Configuración | Informativa | Explica reglas actuales; gestión avanzada pendiente |
| IA y automatización | Pendiente | No se analizan PDF ni se generan resúmenes, audios o preguntas mediante un modelo |
| Exportación y GitHub personal | No iniciados | Requieren V1, auditoría y autorizaciones expresas |

## Cómo funciona

### Flujo del profesor

1. Inicia sesión con la cuenta autorizada.
2. Crea grupos y registra estudiantes.
3. Define coordinador, plan, vigencia y permisos.
4. Publica recursos, cursos, preguntas, simuladores y avisos.
5. Revisa pagos y activa planes.
6. Recibe trabajos, fija plazos, deja observaciones y entrega correcciones.
7. Consulta métricas generales, promedios por estudiante y el detalle de cada intento de simulador.

### Flujo del estudiante

1. Inicia sesión con la misma cuenta de ChatGPT cuyo correo registró el profesor.
2. TUTOSEBAS enlaza la identidad sin sustituir el nombre académico registrado.
3. La API filtra contenido según estado, grupo, plan vigente y permisos.
4. El estudiante consulta materiales y practica preguntas.
5. En simuladores responde todas las preguntas antes de finalizar; la nota se calcula de nuevo en el servidor.
6. Los intentos propios quedan en el historial.
7. Según su plan, entrega trabajos y consulta revisiones.
8. El coordinador puede reportar el comprobante de pago del grupo.

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
- records: entidad flexible para grupos, periodos, recursos, cursos, preguntas, simuladores, intentos, trabajos, pagos y avisos.
- file_objects: inventario verificable de cargas R2 con propietario, grupo, tipo, tamaño y SHA-256.
- rate_limits: límites distribuidos por cuenta, acción y ventana.
- security_audit: bitácora append-only de acciones críticas con retención protegida de 365 días.

El campo records.data_json almacena los atributos específicos de cada tipo. Esta decisión acelera V1, pero obliga a validar cuidadosamente cada tipo y puede requerir normalización en una versión futura.

Las migraciones se encuentran en `drizzle/`. Los índices, triggers y la relación lógica entre tipos están documentados en ARCHITECTURE.md.

Importante: el código fuente no contiene los datos vivos. Los perfiles, intentos, pagos y demás registros están en D1; los archivos cargados están en R2. Ambos deben exportarse aparte cuando se autorice la migración.

El administrador puede generar desde Configuración un respaldo lógico de D1 y del inventario R2. Para recuperación total todavía se necesita una copia externa de los binarios; el procedimiento está en OPERATIONS.md.

## Autenticación y permisos

Sites incorpora cabeceras de identidad verificadas. app/chatgpt-auth.ts las convierte en un usuario interno y lib/uic.ts enlaza esa identidad con profiles.

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
- Probar de extremo a extremo el simulador recién implementado con una cuenta estudiantil real.
- Completar los alcances acordados para Fin de Carrera y Complexivos.
- Definir qué funciones de IA pertenecen a V1 y cuáles pasan a V1.1/V2.
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
