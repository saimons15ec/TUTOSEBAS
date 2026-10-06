# TUTOSEBAS — Contexto del proyecto

Última actualización de contexto: 2026-10-06.

## Decisión más reciente: auditoría y acceso independiente

El propietario autorizó la auditoría final y continuar los seis pasos de lanzamiento. Quiere correos previamente registrados y habilitados, con contraseña inicial asignada por el profesor. Esa autorización posterior rige la preparación y supera las pausas antiguas de exportación; no permite enviar datos privados a GitHub ni retirar Sites sin verificar el destino.

Se implementaron el adaptador independiente, el formulario, la administración de credenciales, cambio inicial obligatorio, cookies seguras, revocación y protección contra identidad de cabeceras. El proveedor real aún no se conectó. El default publicado conserva Sites y la audiencia actual; no cambiarlo a público durante preparación.

Auditoría/inventario y hallazgos: `AUDITORIA_FINAL.md`. Ruta detallada: `LANZAMIENTO_6_PASOS.md`. **288 pruebas aprobadas**. Nuevo respaldo completo y restaurador aislado probados con datos sintéticos. Fuente de producción revisada: v87; la siguiente publicación incorpora estas correcciones y preparación. No hay todavía dominio propio ni despliegue externo verificado.

Los recursos de GitHub/Drive deben pertenecer a la cuenta personal principal. GitHub `saimons15ec` y repositorio privado verificados; la ficha principal tiene función de administrador. Falta acceso a un proyecto Supabase real, Cloudflare propio y la descarga/validación del ZIP real de producción. No pedir contraseñas o claves por chat.

## Para qué existe

TUTOSEBAS es una plataforma privada para acompañar la preparación de estudiantes en la Unidad de Integración Curricular y el examen de fin de carrera. Centraliza contenidos, práctica, simulación, trabajos, revisiones, planes y seguimiento.

Su propósito no es solo mostrar material. Debe permitir administrar quién accede, qué puede ver según su grupo y plan, cómo estudia, qué entrega y qué resultados obtiene.

## Fase actual

El proyecto está en desarrollo y pruebas dentro de ChatGPT Work / Sites. No se ha declarado V1 ni se ha iniciado la migración independiente. La fase estructural de seguridad fue revisada y reforzada; el propietario autorizó una copia privada del código en `saimons15ec/TUTOSEBAS` y respaldos privados en el Drive principal de Saimons.

La versión activa en Sites debe permanecer operativa mientras continúa el desarrollo. El repositorio interno de Sites conserva el historial de publicaciones y GitHub mantiene una copia privada del código; ninguno sustituye los datos vivos de D1 ni los binarios de R2.

El propietario cambió explícitamente el alcance el 2026-10-03: preparar preguntas e importarlas por bloques de materia y tema (por ejemplo, 20 de Tema 1 de Didáctica Ciencias Naturales), sin activar una API de IA. La importación admite los cinco formatos mezclados en ambas áreas, revisión y aprobación conjunta, corrección individual y selección de temas del simulador. La generación desde material se conserva como mejora opcional futura. No se declara V1 por esta implementación.

## Usuarios

### Profesor o administrador

Organiza estudiantes, grupos, periodos, contenido académico, preguntas, simuladores, trabajos, pagos, planes, permisos, avisos y reportes.

### Estudiante

Accede con su propia identidad, estudia contenido permitido, practica preguntas, realiza simuladores, consulta resultados, entrega trabajos y revisa observaciones.

### Coordinador de grupo

Es un estudiante con una función adicional. Puede reportar el pago completo del grupo. No recibe privilegios administrativos generales.

## Flujos funcionales

### Alta y acceso

1. El profesor registra nombre académico, correo, grupo y función.
2. El estudiante ingresa con ChatGPT usando ese correo.
3. El sistema exige el correo exacto normalizado del padrón y enlaza el identificador estable con ese perfil. Un desconocido queda bloqueado sin alta automática. Una identidad ya enlazada no puede cambiar de perfil ni reemplazarse por otra.
4. Una invitación válida pasa a activa al iniciar sesión.
5. El nombre académico no se reemplaza por el nombre de ChatGPT.
6. Una cuenta suspendida no recupera acceso por volver a iniciar sesión.
7. Registrar el perfil interno no concede automáticamente permiso para abrir la URL: el mismo correo también debe figurar entre las personas autorizadas en la audiencia de Sites.

### Grupo y plan

1. El profesor crea un grupo con nombre y código.
2. Puede asignar hasta tres estudiantes y un solo coordinador.
3. El grupo tiene plan, estado, fecha de inicio, vencimiento y permisos manuales.
4. Planes y permisos reúne beneficios de Bronce/Plata/Gold y activación/personalización por grupo: 16 opciones con herencia, activación o desactivación, más correcciones. Conserva los permisos anteriores hasta su edición; la nueva gestión aplica vigencia a sus excepciones.
5. El servidor valida plan y permisos en cada operación sensible.

### Contenido y preguntas

1. El profesor crea un recurso, curso, pregunta o simulador.
2. El contenido nace como borrador o pendiente según el tipo.
3. Solo lo publicado o aprobado llega al estudiante.
4. Las preguntas contienen materia, tema, periodo, alternativas, respuesta, explicación y fuente.
5. El formato Caso práctico de ambas áreas separa el contexto de la situación y la pregunta de análisis; ambos se conservan y se muestran al estudiante.
6. Una pregunta puede vincularse a un material de origen mediante su identificador estable; el servidor verifica que pertenezca a la misma área y materia.
7. Al vincularla, la pregunta conserva una referencia del título, tipo y tema del material, además de heredar su periodo y plan mínimo.
8. Una pregunta vinculada puede guardarse como pendiente mientras el material esté en borrador, pero solo puede aprobarse después de publicar ese material.
9. Los bloques se guardan atómicamente pendientes de revisión, con identificador estable, tema, periodo y filas de origen. Reintentar el mismo bloque no crea copias. Un enunciado con un contexto de caso diferente se considera otra pregunta.
10. Editar una pregunta vuelve a pendiente su revisión sin modificar las instantáneas de intentos ya iniciados o finalizados.

### Práctica y simulación

1. La práctica libre muestra corrección y explicación después de responder.
2. La última pregunta de la práctica se cierra con Finalizar práctica y muestra un resumen con aciertos y opción de repetir.
3. Cada área separa simuladores de práctica por materia y exámenes finales combinados.
4. Un simulador por materia toma exclusivamente entre 5 y 100 preguntas aprobadas de esa materia. Puede equilibrar el reparto por temas y combinarlo con variedad garantizada o cantidades exactas por formato, incluidos bloques mixtos.
5. Un examen final permite seleccionar materias y asignar entre 1 y 100 preguntas a cada una, hasta 200 en total.
6. El simulador selecciona exactamente la distribución configurada. El individual admite todos los temas o un subconjunto; las alternativas con referencias a letras u orden se mantienen fijas, y la clave se recalcula cuando se mezclan las restantes.
7. El estudiante debe responder todo antes de finalizar.
8. No se muestra la clave durante el intento.
9. La API verifica otra vez plan, distribución, preguntas, respuestas y calificación.
10. El intento guarda nota sobre 20, aprobación, duración y detalle.
11. El estudiante ve primer, último, mejor y promedio, además de la revisión final.
12. El portal del estudiante muestra únicamente materiales, preguntas y simuladores del periodo vigente; el historial permanece conservado para administración.
13. Un simulador solo puede publicarse y calificarse con preguntas de su mismo periodo.
14. Al reabrir, se recupera el intento propio activo de ese simulador y grupo si no han pasado cuatro horas; no se expone su clave.
15. En la misma pestaña se conservan las respuestas elegidas y la posición. Si el navegador impide almacenarlas, el simulador continúa y avisa que no debe recargarse durante el intento.

### Trabajos y revisiones

1. Un estudiante de un grupo habilitado carga una planificación o estudio de caso.
2. El archivo queda asociado al grupo y a una solicitud.
3. Una nueva versión del mismo trabajo actualiza la solicitud y aumenta el contador.
4. El profesor asigna estado, plazo, observaciones y archivo corregido.
5. Todo el grupo comparte el historial de esa solicitud.

### Pagos

1. El coordinador selecciona un plan, registra el valor y adjunta comprobante.
2. El profesor aprueba o rechaza.
3. Una aprobación suma 30 días al vencimiento vigente del grupo; si ya venció, los 30 días empiezan en la fecha de aprobación.
4. La revisión queda identificada y repetir una aprobación no vuelve a extender la vigencia.
5. No existe pasarela ni renovación automática.

## Qué ya se ha construido

- aplicación responsive con navegación separada de profesor y estudiante;
- autenticación administrada por Sites y perfil interno;
- autorización por rol, estado, grupo, plan y permiso;
- vencimiento de planes en modo seguro: una fecha ausente, inválida o vencida no concede acceso;
- avisos estudiantiles sin exponer la lista interna de otros perfiles que ya los leyeron;
- separación explícita entre acciones administrativas y estudiantiles, incluso cuando un perfil conserva asociaciones históricas de grupo;
- rol administrativo efectivo derivado de `ADMIN_EMAILS` en cada solicitud;
- D1 con perfiles y registros;
- R2 con carga validada por firma y descarga enlazada a un registro y grupo exactos;
- cargas de entregas bloqueadas antes de llegar a R2 cuando la cuenta, el grupo o el plan no autorizan la acción;
- verificación de origen para mutaciones, tamaño máximo de JSON y errores públicos saneados;
- cabeceras CSP, HSTS, anti-framing, `nosniff` y permisos mínimos del navegador;
- pruebas negativas automatizadas de los controles principales y auditoría de dependencias sin avisos conocidos;
- estudiantes, grupos y coordinadores;
- pagos manuales y activación de planes;
- periodos vigente e histórico;
- recursos, cursos y Normas APA básicas;
- catálogo ampliable de materias para Fin de Carrera y Complexivos;
- contenidos académicos organizados por carpeta de materia, filtro de tipo y secciones de tema;
- banco de preguntas filtrable por área, materia y tema;
- formulario específico para casos prácticos, con contexto, pregunta de análisis y validación independiente;
- selector de material de origen en las preguntas, filtrado por área y materia, con trazabilidad para Infografía, Video y los demás tipos de recurso;
- banco piloto de veinte preguntas aprobadas;
- práctica con retroalimentación;
- simuladores separados por área, práctica por materia y examen final con distribución por materia o bloque y cobertura de todas las materias;
- validación de disponibilidad antes de publicar y calificación con historial de intentos;
- recorrido real de extremo a extremo validado con una cuenta estudiantil: acceso autorizado, lectura de material protegido, inicio y finalización del simulador vigente, resultado persistido y reflejado en reportes;
- prueba funcional del simulador en un teléfono cerrada el 2026-10-03: el propietario confirmó el uso de la cuenta estudiantil y D1 conserva el intento completado a las 18:19:23 UTC (13:19:23 en Ecuador), con calificación, cinco respuestas y asociación al perfil y grupo correctos; esta comprobación complementa las capturas de diseño móvil;
- recuperación segura de un intento activo tras recargar o reabrir el simulador, validada manualmente con una cuenta estudiantil real: conserva el mismo cuestionario en el servidor y las respuestas válidas de la pestaña sin exponer la clave;
- recuperación local tolerante a almacenamiento bloqueado y cuotas agotadas, con borradores de exámenes largos y respuestas malformadas cubiertos por pruebas;
- controles táctiles ampliados del menú y navegación del simulador, con nombres y estados accesibles;
- corrección de pestañas validada visualmente con capturas del teléfono recibidas el 2026-10-03: en la versión 48, Estudio por materia y Examen final ya no se superponen, los tres pasos se muestran completos en vertical y las materias y materiales se ven dentro de sus tarjetas; las capturas corresponden a la vista de muestra del administrador, que no guarda acciones estudiantiles;
- portal estudiantil con dos recorridos visualmente separados: estudio por materia y examen final;
- separación efectiva del periodo vigente en el portal estudiantil, sin borrar los contenidos y simuladores históricos;
- dentro de cada materia, secuencia visible de Materiales, Práctica y Simulador individual;
- trabajos, revisiones y versiones;
- avisos internos;
- reportes de simuladores por estudiante, promedios e historial de intentos;
- vista previa de estudiante para el administrador.
- preparación del primer grupo en Configuración, con accesos a los módulos en orden y estado por materia del periodo elegido; distingue muestras técnicas conocidas, archivos o enlaces publicados, preguntas aprobadas y simuladores con suficiente banco real;

## Qué falta o sigue siendo parcial

- repetir, si se considera necesario, el ciclo positivo de publicación y aprobación con Video; la vinculación pendiente y el ciclo completo con Infografía ya fueron comprobados;
- llenar el alcance académico completo de Fin de Carrera;
- completar rutas, preguntas y simuladores de Complexivos;
- incorporar el primer material académico real, aprobar su banco y dar de alta el primer grupo real; la prueba técnica vigente de Complexivos contiene seis preguntas de ensayo que deben retirarse del banco aprobado antes del uso académico;
- convertir el catálogo de cursos en lecciones y progreso reales si entra en V1;
- generación desde material con IA opcional futura, con proveedor, modelos, credenciales y límites por definir si el propietario decide retomarla;
- crear automatización de análisis de documentos solo cuando exista un proveedor autorizado;
- definir si V1 necesita exportación de reportes o analíticas adicionales a los simuladores;
- crear un entorno separado para ensayar una restauración completa; el paquete recuperable de D1/R2, la auditoría persistente y el límite distribuido de frecuencia ya están operativos;
- auditar datos y archivos antes de exportar;
- crear el paquete independiente y HANDOFF_TO_CHATGPT.md únicamente en la fase autorizada.

## Prioridades de organización académica — solicitud del 2026-10-04

Esta nota conserva el orden solicitado. El catálogo común, la navegación/práctica por tema, los bloques mixtos, el reparto por formatos y la organización de Recursos adicionales están implementados en la fase del 2026-10-04. Cada mejora usa ANALIZA → CONFIGURA → TESTEA, repitiendo el ciclo si falla una comprobación.

### Estado comprobado

- Las materias de Complexivos y Fin de Carrera admiten materiales con tema y tipo, incluidos documentos, infografías y audios MP3, M4A, WAV y OGG. Los archivos de material tienen límite de 25 MB; el audio se ofrece actualmente para descarga.
- Temas compartidos implementados: identificador estable, número, nombre y orden natural en ambas áreas. Materiales, bloques y preguntas eligen del catálogo común; la práctica usa la misma referencia. La organización inicial reconoce los nombres existentes y mantiene alias; marca los números repetidos o nombres largos para revisión, conservando los archivos e intentos.
- Un bloque de 20 preguntas puede mezclar los cinco formatos actuales: Selección directa, Completar, Relacionar, Ordenar y Caso práctico. Cada pregunta conserva su formato; el bloque pertenece a una materia, un tema y un periodo. La importación requiere alternativas, clave, explicación y fuente, con contexto separado en Caso práctico.
- La práctica permite escoger tema, un formato o todos y cantidad, y sortea preguntas aprobadas sin repetir dentro de la práctica. Repasar tema desde Materiales selecciona ese tema en la práctica. Los temas sin preguntas muestran disponibilidad cero en el mismo catálogo.
- El simulador individual puede equilibrar temas; individual y final admiten variedad, cantidades exactas por formato o sorteo del conjunto. Se resuelve la disponibilidad conjunta por tema/materia/bloque y formato, con rechazo de repartos imposibles al publicar o iniciar. El final mantiene cantidades por materia o bloque, área, periodo, permisos y claves privadas.
- Recursos adicionales comparte Currículo/Cursos/Apoyo APA/Otros materiales entre profesor y estudiante. Ofrece categoría en la carga, búsqueda, filtro por tipo, edición y archivo reversible. Permite referencias a materiales de materias sin duplicar adjuntos ni modificar sus permisos. Cursos incluyen lecciones y avance privado; Normas APA mantiene su asistente básico.

### Avance de la fase de temas y bloques

- Prioridades 1, 2 y 3: implementadas; la opción Mixto descarga Word/CSV con cinco estructuras y exige formato explícito por pregunta, con conteos antes de guardar.
- Renombrar/reordenar mantiene el topicId y actualiza contenido vigente y filtros de simuladores. Los bloques nuevos conservan la identidad de reintento al cambiar un nombre. Los registros de otros periodos, archivados e instantáneas de intentos permanecen intactos.
- Prioridades 4 y 5: implementadas. Variedad o cuotas exactas por formato compatibles con temas, materias y bloques; Recursos adicionales con categorías, búsqueda, tipos, edición y archivo reversible. Las referencias usan el mismo registro/archivo y conservan su materia y plan.
- Prioridad 6: verificación automática de esta fase y del comportamiento existente realizada; revisión visual de escritorio/móvil pendiente porque no hay navegador de pruebas en el entorno. Aún se requiere contenido académico real revisado para declarar candidata a V1.

### Orden de ejecución

| Orden | Mejora | Resultado esperado y criterio de cierre |
| --- | --- | --- |
| 1 | Catálogo común de temas por materia | Crear temas con identificador estable, número, nombre y orden. Materiales, bloques y preguntas referencian el mismo tema dentro de su área, materia y periodo. Revisar la correspondencia de datos existentes; conservar archivos e historial y dejar nombres ambiguos para revisión. |
| 2 | Materiales y práctica desde el mismo tema | Navegar Materia → Tema 1, 2, 3 → materiales y práctica. Admitir varios documentos, infografías y audios por tema, con filtro de tipo. Abrir la práctica desde el tema seleccionado y mostrar cuántas preguntas aprobadas hay; un tema sin banco debe explicar qué falta. |
| 3 | Completar la experiencia de bloque mixto | Añadir una opción/plantilla Mixto junto a las plantillas por formato. Identificar el formato de cada pregunta, mostrar conteos y errores por fila antes de guardar, y mantener revisión/aprobación del bloque. Aceptar varios bloques del mismo tema sin duplicar preguntas al reintentar. |
| 4 | Sorteo controlado por tema y formato | Añadir variedad garantizada y cantidades opcionales por formato al simulador individual y al final, manteniendo cantidades por materia o bloque. Calcular disponibilidad conjunta de temas y formatos; impedir publicar o iniciar una distribución imposible y explicar la falta. Evitar repeticiones y preservar casos, orden de alternativas, calificación y recuperación del intento. |
| 5 | Reorganizar Recursos adicionales | Definir categorías comunes para carga, administración y estudiante: currículo, apoyo APA, cursos y otros recursos de apoyo. Añadir categoría, búsqueda, filtros, edición y archivo reversible. Usar referencias a materiales de materia/tema cuando corresponda, conservando una copia del archivo. Mantener publicación, plan y permisos; Cursos ya incluye lecciones/progreso en la fase del 2026-10-04; reproducción integrada de audio sigue pendiente. |
| 6 | Verificación integrada antes del uso académico completo | Probar una materia con cinco temas, materiales de distintos tipos y bloques mixtos. Verificar práctica por tema, distribución por temas/formatos, final combinado, falta de preguntas, duplicados, separación de periodos, permisos, claves privadas e historial. Completar revisión visual de escritorio y móvil cuando el entorno lo permita. |

La ruta usa un banco aprobado compartido por práctica, simulador de materia y examen final. Subir un material lo incorpora como apoyo/fuente; el bloque debe incluir preguntas ya preparadas. Esta organización no requiere activar una API de IA. Si se pretende incluir cinco formatos y cinco temas en una prueba, la distribución debe resolverse con el banco realmente disponible, sin imponer que todas las combinaciones tema/formato existan.

## Decisiones funcionales importantes

- Cada estudiante usa su propia cuenta.
- El correo registrado enlaza la cuenta; la cédula no es contraseña.
- Solo se guardan opcionalmente los últimos cuatro dígitos de identificación.
- El nombre registrado por el profesor es la referencia académica.
- Un grupo admite máximo tres integrantes.
- Solo un integrante puede ser coordinador.
- Los planes son Bronce, Plata y Gold.
- La vigencia y los permisos se aplican al grupo.
- El profesor puede conceder acceso manual.
- Una pregunta debe aprobarse antes de utilizarse.
- La nota del simulador se calcula sobre 20.
- La nota mínima es configurable y por defecto es 14.
- La respuesta correcta se revela solo después de finalizar el simulador.
- Los intentos pertenecen al estudiante que los realizó.
- Las revisiones del mismo documento permanecen en una solicitud.
- Los pagos son comprobantes manuales.
- Los comprobantes y sus archivos solo son visibles para el administrador y el coordinador del grupo.
- Cada pago aprobado se aplica una sola vez y conserva los días no utilizados del plan.
- Periodos históricos no deben mezclarse con el vigente.
- No se elimina información durante desarrollo sin autorización expresa.

## Decisiones técnicas importantes

- Se conserva la arquitectura actual mientras la aplicación funciona en Sites.
- La autenticación se encapsula en app/chatgpt-auth.ts para poder sustituirla más adelante.
- La autorización real vive en rutas de servidor, no únicamente en botones o pantallas.
- D1 almacena datos estructurados.
- R2 almacena archivos; D1 conserva sus claves.
- Las cargas nuevas también se registran en file_objects con SHA-256; auditoría y límites viven en tablas separadas de la lógica académica.
- La bitácora de seguridad es append-only durante 365 días y el respaldo lógico se descarga únicamente con rol administrador.
- La tabla records permite evolucionar rápidamente diferentes módulos en V1.
- Las migraciones Drizzle describen el esquema, aunque las consultas operativas actuales usan D1 preparado directamente.
- Las semillas son idempotentes mediante identificadores estables e INSERT OR IGNORE.
- El banco piloto también permanece como JSON dentro del código para poder crear una instalación nueva.
- La futura portabilidad se resuelve mediante documentación y adaptadores, no desmontando anticipadamente lo que Sites ofrece.
- La copia externa completa se conserva en `TUTOSEBAS/Respaldos privados` del Drive principal: incluye el respaldo lógico vigente, 11 binarios R2 y huellas SHA-256 verificadas. El Site privado de restauración sigue pendiente y no debe improvisarse sobre producción.

## Decisiones de diseño

- Identidad visual: azul marino, turquesa y fondos claros.
- Densidad de panel administrativo sin convertir el portal estudiantil en una pantalla técnica.
- Navegación lateral en escritorio y menú móvil.
- Estados con etiquetas claras.
- El profesor puede alternar a una vista de muestra de estudiante.
- Los controles de práctica priorizan lectura y toque en móvil.

## Datos piloto y privacidad

El entorno activo contiene datos reales de una prueba piloto. Los correos y demás datos personales no deben copiarse a documentación, ejemplos ni un futuro repositorio salvo que sean estrictamente necesarios y estén autorizados.

El código, D1 y R2 son tres superficies diferentes. Tener el código no equivale a tener cuentas, intentos, pagos, trabajos ni archivos.

## Dependencias actuales del entorno

Sites proporciona actualmente:

- inicio de sesión y cabeceras de identidad;
- control de audiencia del sitio;
- inyección de bindings D1 y R2;
- aplicación de migraciones al publicar;
- repositorio interno y despliegue del Worker;
- URL y TLS administrados.

Estas dependencias se mantienen durante el desarrollo. ARCHITECTURE.md detalla cómo sustituirlas al migrar.

## IA

No existe conexión activa con un proveedor de IA. El flujo vigente utiliza contenidos preparados e importación de preguntas por bloques y funciona sin credenciales ni consumos de IA. El verificador APA es heurístico y local.

La decisión del propietario del 2026-10-03 reemplaza la generación obligatoria desde material por carga de bloques por tema. Documento, Resumen, Infografía, Audio, Video, Presentación y Guía de estudio clasifican materiales subidos; no generan productos. El plan de generación original queda conservado como una mejora opcional futura en AUTOMATIZACION_ACADEMICA.md y no bloquea el primer uso con bancos preparados.

Ampliación del 2026-10-03: los bloques ya preparados pueden leerse desde Word .docx o PDF con texto seleccionable, además de Excel/CSV y texto pegado. La plantilla Word y la vista previa conservan claves, contexto y explicación; no existe OCR ni generación desde material. El examen final permite seleccionar bloques del mismo periodo y área (hasta 30), asignar 1–100 preguntas por bloque y hasta 200 en total, según banco aprobado. El modo anterior por materias permanece. Publicación y sorteo validan D1 nuevamente; intentos guardados mantienen sus instantáneas.

Al revisar el primer grupo indicado por el propietario, el grupo, sus tres perfiles, el coordinador y Gold ya estaban registrados correctamente. La materia ya existe bajo el nombre Didáctica Ciencias Naturales y no tenía materiales. No duplicar esos datos. El permiso externo para abrir la URL debe verificarse por separado del padrón interno.

Antes de implementar IA se debe definir:

- funciones incluidas en V1;
- proveedor y modelo;
- tratamiento de archivos y datos personales;
- claves y variables;
- límites, costos y registro;
- revisión humana;
- alternativa portable fuera de Sites.

## Criterios acordados para V1

V1 no se declara por apariencia visual. Deben comprobarse razonablemente:

- profesor y estudiante;
- autenticación y autorización;
- navegación;
- materias;
- banco de preguntas;
- simuladores, resultados e historial;
- archivos y persistencia;
- funciones de IA que finalmente se incluyan;
- escritorio y móvil;
- manejo de errores;
- ausencia de errores críticos conocidos.

Al cumplirlos se detiene el desarrollo de funciones importantes y se solicita permiso para iniciar la auditoría, siguiendo DEVELOPMENT_RULES.md.

## Guía para una nueva instancia de ChatGPT

1. Lee todos los documentos esenciales.
2. Inspecciona el estado real del código y del control de versiones.
3. No supongas que una función descrita como pendiente ya existe.
4. No exportes, conectes GitHub o migres sin las aprobaciones descritas.
5. No borres archivos, registros o infraestructura.
6. Mantén el Site actual funcionando.
7. Después de cada cambio funcional, actualiza la documentación correspondiente.
8. Antes de modificar arquitectura, explica el impacto sobre Sites y la futura portabilidad.
9. Al acercarse V1, aplica los criterios y muestra el aviso obligatorio.

La meta de traspaso es que, después de la migración autorizada, este chat pueda desaparecer sin impedir continuar TUTOSEBAS desde el repositorio personal y una nueva cuenta de ChatGPT.


## Plantillas y tres recorridos académicos (2026-10-03)

La captura del propietario mostró Completar seleccionado con plantillas genéricas. Ahora Word y CSV se generan con instrucciones, columnas y dos ejemplos del formato elegido. Selección directa, Completar, Relacionar, Ordenar y Caso práctico conservan alternativas, clave, explicación y fuente; Caso práctico añade contexto. Los ejemplos deben reemplazarse y no cuentan como banco académico preparado mientras conserven sus marcadores.

Práctica: el estudiante elige tema, formato y cantidad (1–100), y sortea preguntas aprobadas de su materia y periodo, con corrección inmediata. Simulador de materia: 5–100 preguntas; las nuevas configuraciones proponen cubrir cada tema del banco aprobado y repartir la cantidad respetando la disponibilidad. Si la cantidad no alcanza para incluir todos los temas o falta banco de un tema seleccionado, no puede publicarse o iniciarse. Los simuladores anteriores conservan su configuración hasta editarlos.

Examen final: las nuevas configuraciones parten de todas las materias del área, con cobertura completa activada. Permite 1–100 preguntas por materia o bloque, hasta 200 y hasta 30 materias/bloques. Se puede combinar cualquiera de los cinco formatos y todos sus temas. Reparto por formato permite variedad garantizada o cuotas exactas también dentro de bloques mixtos; el conjunto de cantidades por materia/bloque y formato debe ser factible con el banco aprobado. La cobertura completa se verifica en D1 al publicar y al crear un intento nuevo; una evaluación parcial se configura desactivándola. No mezcla Complexivos y Fin de Carrera ni periodos. El mismo banco aprobado alimenta los tres recorridos.

## Verificación del reparto y apoyo académico (2026-10-04)

Las suites de formatos y recursos se suman a seguridad, importación, documentos y temas. La comprobación integrada actual suma 107 pruebas aprobadas; TypeScript y ESLint también se verifican antes de construir y publicar. El recorrido visual nuevo de escritorio/móvil queda pendiente porque este entorno no dispone de navegador de pruebas.

- Las cinco estructuras se mantienen como alternativas con una clave; no se añaden respuestas libres ni pares arrastrables. El algoritmo de capacidades asigna juntas las cantidades de los grupos y los formatos, permite variedad con bancos escasos y no sustituye preguntas por otras materias, temas o bloques.
- Las configuraciones anteriores conservan sorteo del conjunto. Las nuevas proponen variedad. Las instantáneas registran formatos permitidos, cuotas configuradas y reparto realmente usado. Recuperación, calificación y claves privadas siguen en el servidor.
- Recursos generales y cursos nuevos usan el periodo vigente, tipos y categorías válidos, URLs HTTP(S) sin credenciales, archivos registrados del profesor y revisión antes de publicar. Audio requiere un archivo de audio; los adjuntos siguen limitados a 25 MB y sus tipos validados en /api/files.
- Editar apoyo general cambia solo metadatos, regresa a borrador y conserva archivo/enlace, periodo y campos propios del curso. Una escritura concurrente se rechaza antes de sobrescribir cambios. La referencia de una materia solo cambia additionalCategory; quitarla no archiva el material original.
- Catálogo y descarga protegida rechazan recursos de periodos históricos para estudiantes. Los cursos básicos existentes sin periodo siguen disponibles según publicación, plan y permisos.
- Falta incorporar y revisar el contenido académico real. No se activa una API de IA, no se migra, no se cambia la audiencia de Sites y no se declara candidata a V1.

## Revisión integrada del recorrido académico

Las áreas Complexivos y Fin de Carrera concentran la gestión en Materiales → Preguntas → Simuladores. La materia se conserva entre los tres pasos; el tema pasa de materiales a importación y revisión. Importar abre el tema correspondiente y los bloques muestran aprobación completa junto a la aprobación individual. La práctica habilita solo formatos con banco aprobado, selecciona automáticamente el único disponible y ofrece Practicar / Volver a practicar con cantidades válidas.

La revisión posterior reprodujo un defecto del reparto equilibrado: SQL ordenaba Tema 1, Tema 10, Tema 2, mientras la vista previa usaba Tema 1, Tema 2, Tema 10. Cuando el total dejaba preguntas restantes, las cuotas por tema podían diferir y el servidor rechazar cantidades por formato que la vista previa consideraba posibles. `planTopicCoverage` ahora aplica el mismo orden natural con desempate determinista a ambos planes; no modifica las instantáneas de intentos guardados.

Siete regresiones comprueban el desacuerdo original y su corrección: las dos áreas, los tres modos de reparto por formato, cuotas exactas en el sorteo SQL, ausencia de preguntas repetidas, periodos/preguntas pendientes excluidos y orden independiente de la entrada. La suite completa suma 124 pruebas aprobadas. Sigue pendiente la revisión visual del flujo nuevo en escritorio/móvil y la revisión académica del primer banco real.

## Comprobación del examen final en ambas áreas

`tests/final-exam-api.test.mjs` ejecuta el endpoint real `/api/platform`, el contexto/perfil, las consultas y los controles de autorización sobre SQLite en memoria con las dos migraciones de D1. El adaptador de pruebas proporciona únicamente el binding Cloudflare y las cabeceras de identidad; no accede a D1/R2 vivos ni comprueba el inicio de sesión externo o la presentación visual.

Doce recorridos positivos cubren Complexivos/Fin de Carrera, selección por materias/bloques y reparto pool/varied/quota. Comprueban cantidades exactas por materia y bloque, cinco formatos, preguntas únicas del área/periodo vigente, claves ocultas, recuperación del mismo intento, calificación sobre 20, explicación final, historial del estudiante y finalización idempotente. Revalidan propiedad del intento y conservan la instantánea aunque el banco se modifique después de iniciarlo.

Dos escenarios negativos comprueban cantidades cero/fraccionarias/excesivas, materias repetidas o faltantes, total mayor de 200, bloques ajenos/históricos/desconocidos, banco insuficiente, examen en borrador, plan vencido, alternativas vacías/no numéricas, nota de reprobación y vencimiento del intento. Reprodujeron y corrigieron una conversión indebida: `null`, booleanos y otros valores podían convertirse a la alternativa 0. La calificación ahora acepta únicamente índices numéricos enteros entre 0 y 3. Si falta una respuesta válida, el endpoint devuelve 400 sin completar el intento ni registrar una nota.

La suite completa suma 139 pruebas aprobadas, incluidas estas pruebas de API y la regresión de calificación. `pnpm test` ejecuta también el archivo MJS; `pnpm test:final-exams` permite repetir únicamente la comprobación de los finales. La verificación visual nueva y el primer banco académico real permanecen pendientes.

## Recursos y cursos funcionales (2026-10-04)

Se aplicó ANALIZA → CONFIGURA → TESTEA a esta sección. Recursos conserva las categorías compartidas y añade estados para profesor, limpieza de filtros, destino visible tras carga/edición y sustitución explícita de archivo/enlace que conserva el objeto anterior y devuelve a borrador. Publicar requiere contenido real. Referencias académicas mantienen la materia, tema, adjunto y permisos originales.

Cursos usa la tabla records existente: course → course_lesson, con orden, duración, instrucciones, tipos compartidos, archivo/enlace y revisión. Gestionar curso concentra Materiales → Revisión → Publicación. Ofrece publicación individual y conjunta de lecciones, cambio de orden, archivo/restauración y publicación independiente del curso. Hasta 100 lecciones activas. Los contadores antiguos no fabrican lecciones; cursos sin contenido se conservan para administración y se ocultan del catálogo estudiantil.

course_progress es privado por perfil/lección, persiste al recargar y permite volver a pendiente. Compañeros del mismo grupo no comparten avances. Editar una lección requiere una nueva marca de completado; reordenar no la invalida. Las lecciones heredan publicación, periodo, plan y permisos del curso tanto en el catálogo como en las descargas de R2. La vista previa no guarda progreso. El inventario/reconciliación reconoce los archivos de lecciones.

Las pruebas detectaron que comparar JSON reserializado tras json_set podía confundir números 3 y 3.0. Se usa el snapshot exacto almacenado y una sentencia con materialización para publicaciones y cambios de orden atómicos. Se eliminó data_json de la respuesta del catálogo para que no eluda el filtrado de claves de preguntas. La regresión de examen final cubre la ausencia de ese campo.

La guía manual está incorporada en Recursos y cursos: recurso con archivo → curso de dos lecciones/tipos → publicación → cuenta estudiante/avance → ocultación y restauración. Falta la comprobación visual real de escritorio/móvil y contenido académico del propietario; no se declara V1 ni se migra/exporta.

Verificación de esta entrega: 153 pruebas automáticas aprobadas, incluidas 14 pruebas API de Recursos/Cursos y 14 de examen final. TypeScript y ESLint de los archivos modificados sin errores. Compilación/publicación se verifican por el flujo de Sites; revisión visual manual pendiente.


## Organización visual de Recursos y cursos (2026-10-04)

Petición del propietario: explicar qué significa cada sección y pulir la organización. El ciclo ANALIZA detectó categorías sin propósito visible, botones globales sin destino claro, acciones dispersas fuera de tarjetas y una ficha APA que anunciaba un curso no cargado.

CONFIGURA conserva las claves curriculum/courses/apa/other y todos los registros, lecciones, archivos, progreso y reglas del servidor. Nombres visibles: Currículo y planificación, Cursos por lecciones, Normas APA y Biblioteca general. La navegación tiene iconos, descripción corta, contador y selección visible. El panel activo muestra explicación, ejemplos y acciones contextualizadas; los filtros tienen etiquetas. Los cursos reales se separan de materiales complementarios de cursos. APA separa herramientas desplegables de archivos cargados y deja de anunciar lecciones inexistentes. Opciones reúne edición/sustitución/archivo en cada tarjeta y mantiene los diálogos fuera del menú para preservar foco. Los archivados se consultan por sección; la guía manual queda al final. Profesor y estudiante comparten la clasificación. La publicación de referencias académicas se controla desde su materia original.

TESTEA: comprobar tipos, lint, renderizado estructural, suite de recursos/cursos y compilación antes de publicar. La revisión visual real en escritorio/móvil sigue pendiente cuando haya navegador de pruebas disponible; no se declara V1.

Verificación de esta reorganización: 153 pruebas funcionales aprobadas y 9 escenarios de renderizado estructural (cuatro secciones por rol y curso vacío). Tipos, ESLint de los archivos modificados con cero advertencias y diff check aprobados. Los escenarios confirman contenido/archivados por sección, ausencia de acciones administrativas para estudiantes, grupos separados de cursos/apoyo y panel APA desplegable. Son controles de estructura, no una inspección visual en navegador. La compilación y publicación se completan con el flujo de Sites.

## Secciones administrables de recursos (2026-10-04)

Petición actual: separar Planificaciones, Currículos y Normas APA y poder añadir/quitar secciones. ANALIZA identificó cuatro categorías fijas y la necesidad de conservar contenido, cursos, progreso e historia. CONFIGURA añade cinco secciones iniciales (planning/curriculum/courses/apa/other) y configuraciones resource_section del periodo vigente en records, sin migración. Los contenidos antiguos curriculum se conservan en Currículos; el profesor puede moverlos desde Opciones. Gestionar secciones permite añadir, renombrar, ordenar, quitar con destino y restaurar; admite hasta 50 activas y exige conservar al menos una. La clasificación, nombres y orden son compartidos con estudiantes; la administración es exclusiva del profesor.

Tipos de sección: materiales, cursos con lecciones y materiales/ayuda APA. El tipo es inmutable al editar. Quitar mueve todo el contenido vigente o heredado, incluso archivados y referencias a materias, mediante una sentencia atómica que valida instantáneas y cancela ante cambios concurrentes. Conserva estado, plan, archivos, materia y avance; cursos solo se mueven a una sección de cursos. Secciones retiradas conserva configuración y permite restaurar sin devolver automáticamente los materiales. Los periodos históricos se conservan. Las escrituras de contenido revalidan el destino activo en el servidor y dentro de SQL; el catálogo estudiante incluye tombstones para ocultar secciones iniciales retiradas.

TESTEA incorpora 12 escenarios API reales con D1/R2 aislados: separación inicial y lectura sin escrituras, creación/renombre/orden/búsqueda, permisos y entradas inválidas, retiro/restauración con archivos e historia, destinos retirados, curso con avance privado, cambio de sección de curso, carreras de contenido/configuración, reordenación atómica, nombres duplicados y límites. La guía manual visible incorpora estos controles. Verificación visual real de escritorio/móvil pendiente por ausencia del navegador de pruebas soportado; no se declara V1 ni se migra/exporta.

Verificación automática de esta entrega: 165 pruebas funcionales y 6 escenarios de renderizado estructural aprobados, TypeScript sin errores y ESLint de los archivos modificados con cero advertencias. El renderizado verifica las secciones iniciales separadas, secciones personalizadas de los tres tipos, controles exclusivos del profesor y ocultación de una sección inicial retirada. La compilación/publicación se realiza por el flujo soportado de Sites, manteniendo audiencia y bindings D1/R2.

## Registro obligatorio y planes configurables (2026-10-04, Guayaquil)

ANALIZA: el ingreso podía crear perfiles pendientes desconocidos y buscar alternativamente por identidad/correo. Planes mostraba grupos y concesiones generales, sin un editor de beneficios. Se conservó la audiencia privada de Sites, el padrón existente, archivos, intentos, fechas y bases acordadas. Registrar un estudiante sigue sin conceder automáticamente el permiso externo para abrir la URL.

CONFIGURA: el correo normalizado debe estar registrado antes de enlazar la identidad, con bloqueo de cambios/reasignaciones y suspensión concurrente. Un desconocido recibe un estado virtual sin escribir perfiles; el administrador configurado mantiene su inicialización controlada. Se añadieron beneficios desplegables por Bronce/Plata/Gold y personalización por grupo para 16 funciones. Se pueden habilitar todas o restaurar la base, heredar o definir excepciones y correcciones. Guardar permisos conserva fechas; activar plan establece una nueva vigencia. Las excepciones del grupo prevalecen sobre las del plan; las nuevas configuraciones vencen con el plan y admiten solo capacidades estudiantiles. Los cambios globales afectan a los grupos del plan, conservando excepciones particulares.

La API y R2 comparten la política para contenidos, cursos/progreso, trabajos y evaluación. Práctica, simulador de materia y final son independientes en ambas áreas; la interfaz explica los permisos retirados. La compatibilidad previa se conserva hasta editar el grupo, sin una migración masiva. Los registros plan_template y la configuración de grupo se guardan en records con revisiones y comparaciones atómicas. Los archivos y el historial no se eliminan al revocar un beneficio.

TESTEA: 13 escenarios nuevos de API cubren registro, suspensión, enlaces de identidad, carreras concurrentes, beneficios globales/excepciones, vigencia, archivos, cursos, APA, ambas áreas académicas, trabajos/correcciones y entradas inválidas. La suite completa suma 178 pruebas aprobadas. Ocho escenarios de renderizado estructural comprobaron planes, opciones accesibles, herencia/personalización y grupo vencido. TypeScript y ESLint de los archivos modificados pasaron sin errores ni advertencias. pnpm test:access permite repetir la suite específica. La inspección visual y el proveedor externo de login no se probaron en este entorno; siguen pendientes los criterios académicos/visuales para V1. Se construye/publica por Sites sin cambiar audiencia, DB ni BUCKET.

## Mejoras secuenciales autorizadas (2026-10-04, Guayaquil)

El propietario autorizó las 20 mejoras de la revisión, una a una y con ANALIZA → CONFIGURA → TESTEA. IMPROVEMENTS.md mantiene el orden, estado y evidencia. La primera incorpora edición/sustitución académica sin cambiar materia/tema, versiones de materiales, revalidación de preguntas vinculadas y protección de concurrencia. Cinco escenarios API nuevos pasan; total 183. No se declara V1 ni se altera la audiencia.

Mejora 2: edición explícita de fichas sin cambiar identidad ni estado; restricciones atómicas de grupo y coordinador. Tres pruebas API específicas aprobadas; seguimiento y publicación en IMPROVEMENTS.md.

### Mejora 3: Requisitos de acceso

ANALIZA: El registro interno no sustituye la lista privada de Sites; faltaba explicarlo dentro del alta. CONFIGURA: Alta de estudiantes, Configuración e ingreso muestran dos requisitos independientes mediante AccessRequirements. El registro y la autorización externa se explican por separado; no se consulta ni modifica la audiencia automáticamente. TESTEA: 13 regresiones de acceso y dos renderizados estructurales; tipos/lint aprobados

### Mejora 4: Beneficios efectivos del estudiante

ANALIZA: El estudiante veía su plan y vigencia, sin un inventario completo de opciones personalizadas. CONFIGURA: Mi plan y pagos incluye Tus beneficios actuales con las 16 opciones y su estado efectivo. PlanBenefits usa canUsePlanFeature y el catálogo actualizado, con herencia, excepciones y vencimiento; explica el mínimo del contenido y permisos individuales. TESTEA: 13 regresiones de acceso y cuatro escenarios de renderizado; tipos/lint aprobados

### Mejora 5: Vista previa por grupo

ANALIZA: La muestra Gold no permitía examinar excepciones ni grupos vencidos. CONFIGURA: En modo Estudiante del profesor, el selector permite Gold de muestra o un grupo guardado. buildGroupPreview filtra publicación, periodo y permisos con la política compartida; excluye historia privada y progreso. El banco para simular se separa del banco visible de práctica. Las entregas, pagos y avance quedan deshabilitados; el grupo y beneficios reflejan la selección. TESTEA: 3 escenarios nuevos y 13 de permisos; tipos/lint aprobados tras corregir el contexto

### Mejora 6: Conservar navegación

ANALIZA: La ruta y las selecciones se perdían al cambiar de pestaña o volver desde otra sección. CONFIGURA: La navegación valida rutas según el rol, admite Atrás/Adelante y recuerda materia, tema y paso por usuario, área y periodo en sessionStorage; solo guarda selecciones de navegación. TESTEA: Tres pruebas de rutas, separación de selecciones y almacenamiento bloqueado; tipos y lint correctos.

### Mejora 7: Cambios sin guardar

ANALIZA: Los cierres y cambios de sección podían descartar formularios editados sin aviso. CONFIGURA: Registro temporal de borradores por formulario, aviso al cancelar o salir, guardia de navegación y beforeunload. Los diálogos detectan campos y adjuntos; planes, avisos, entregas y pagos registran su estado. Guardar limpia únicamente ese ámbito. No persiste contenido del borrador. TESTEA: Tres pruebas de conservar, descartar, guardar y revertir cambios; tipos y lint correctos.

### Mejora 8: Guardado y doble clic

ANALIZA: Varios botones permitían reenviar una acción antes de terminar el primer envío. CONFIGURA: Los botones con acciones asíncronas indican Procesando y bloquean clics concurrentes; los POST del panel comparten una sola operación para cuerpos equivalentes mientras están pendientes. Un fallo libera el bloqueo para reintentar. TESTEA: Tres pruebas de concurrencia, recuperación y separación de solicitudes; suite completa, tipos y lint correctos.

### Mejora 9: Gestión de periodos

ANALIZA: Faltaba crear/activar convocatorias; algunas consultas y la gestión de materias omitían el periodo y podían afectar el histórico. CONFIGURA: Crear periodo valida años consecutivos y lo deja en preparación. Activar cambia la selección de forma atómica con revisión, conserva contenidos e intentos y exige confirmación descriptiva. Materias, referencias, temas y cobertura de exámenes filtran por convocatoria; las altas usan el periodo vigente y condiciones SQL impiden altas durante un cambio concurrente. No se activa ninguna convocatoria real durante las pruebas. TESTEA: Cuatro escenarios API nuevos y 202 pruebas completas, incluyendo concurrencia, historia, permisos, años y aislamiento; se actualizó el contexto de dos fixtures y se comprobó el catálogo histórico; tipos/lint correctos.

### Mejora 10: Motivos de rechazo de pagos

ANALIZA: El rechazo usaba un texto fijo y el coordinador no veía una explicación concreta. CONFIGURA: Rechazar abre un formulario de motivo obligatorio de hasta 1000 caracteres; el servidor valida y conserva autor/fecha. Profesor y coordinador ven la nota junto al pago; los demás integrantes siguen sin recibir comprobantes. Se conserva la revisión definitiva y la renovación idempotente. TESTEA: Tres escenarios API nuevos y 13 regresiones de acceso; rechazos inválidos, privacidad y extensión única de 30 días comprobados; tipos/lint correctos.

### Mejora 11: Cola de tareas

ANALIZA: La cola era informativa; los accesos no garantizaban llegar a la materia, tema o pestaña de evaluación adecuada. CONFIGURA: La cola abre pagos, revisiones y tareas académicas del periodo vigente separadas por área. Los destinos incluyen materia/tema y examen final; los pasos académicos se sincronizan con la ruta y el historial. Las selecciones se guardan antes del cambio y toleran almacenamiento bloqueado. Los indicadores académicos excluyen periodos anteriores. TESTEA: Tres escenarios nuevos y 11 regresiones de rutas/gestión académica; destinos, separación temporal y parámetros acotados comprobados; tipos/lint correctos.

### Mejora 12: Menú agrupado

ANALIZA: El menú continuo hacía difícil distinguir gestión académica, grupos y seguimiento. CONFIGURA: El profesor ve Inicio, Gestión académica, Grupos y acceso, Seguimiento y Cuenta; el estudiante ve Inicio, Estudio, Trabajos, Mi grupo, Cuenta y avisos. Un componente compartido mantiene las mismas rutas y avisos en escritorio/móvil, con destino activo accesible y controles de vista de al menos 44 px. TESTEA: Siete pruebas de navegación/cola y dos renderizados de menú completos; todos los destinos se conservan una sola vez, avisos y aria-current correctos; tipos/lint correctos.

### Mejora 13: Versiones de revisiones

ANALIZA: Enviar otra versión reemplazaba la referencia anterior y la descarga histórica dejaba de estar disponible. CONFIGURA: Las solicitudes guardan hasta 200 eventos de entrega/revisión con versión, autor, fecha, archivo, notas y plazo, sin truncarlos. Reenviar limpia la corrección actual y conserva la anterior en la cronología. Las revisiones exigen versión actual y CAS; nuevas entregas protegen la solicitud/permisos. Profesor y grupo ven la cronología; archivos históricos y reconciliación validan sus enlaces. El legado conserva solamente la última versión disponible, sin inventar anteriores. TESTEA: Tres escenarios API nuevos, dos renderizados de cronología y 212 pruebas completas; archivos históricos, aislamiento, límites y concurrencia comprobados; tipos/lint correctos.

### Mejora 14: Filtros y paginación

ANALIZA: Las listas extensas carecían de filtros homogéneos; los reportes podían tratar intentos abiertos como notas de cero. CONFIGURA: Estudiantes, grupos, pagos, revisiones, entregas y reportes incorporan búsqueda sin diferencias de acentos, estado/grupo/fechas según el módulo y páginas de 10/20/50 registros. Reportes agrega periodos, resúmenes del filtro y calificaciones finalizadas válidas, preservando los ceros reales. Fechas SQLite se interpretan como UTC y se muestran/filtran en Ecuador. La cola abre los filtros pendientes/activos. El filtrado y las páginas operan sobre los registros autorizados ya cargados. TESTEA: Seis escenarios nuevos de filtros, fechas, páginas y promedios; 13 pruebas de listas/rutas y cuatro renderizados de pantallas; tipos/lint correctos.

### Mejora 15: Restaurar materias

ANALIZA: Quitar materias archivaba sus contenidos sin una recuperación guiada; la recuperación debe conservar historia y evitar publicaciones automáticas o cambios en otra convocatoria. CONFIGURA: Gestionar materias permite Restaurar y recuperar contenidos más tarde. Catálogo activo, materiales/simuladores en borrador, preguntas/bloques pendientes; archivos e intentos intactos. Los exámenes recuperan sus cuotas anteriores solo si no se editaron después. Conflictos de temas, revisiones concurrentes y cambios de periodo bloquean la operación. Materias archivadas exigen restauración explícita. TESTEA: Seis escenarios API nuevos y 224 pruebas completas: ambas áreas, archivos privados, catálogo solo, legado, conflictos de temas, permisos, concurrencia y periodo; tipos y lint correctos

### Mejora 16: Presentación uniforme

ANALIZA: Controles compactos, ventanas largas y selección de archivos con input oculto dificultaban el uso móvil y por teclado; el grupo duplicaba una parte de la gestión de accesos. CONFIGURA: Botones, entradas, selectores y pestañas tienen área táctil mínima de 44 px. Textos adaptables, ventanas acotadas con desplazamiento, cierres en español y acciones que se ajustan al ancho. Selector de archivos accesible por teclado con formatos, límite de 25 MB y quitar selección. Los grupos conducen a Planes y permisos; la vista previa de cuenta no cierra la sesión real. TESTEA: Seis comprobaciones por renderizado y siete regresiones de navegación, borradores y concurrencia; tipos y lint correctos. Evaluación visual en navegador pendiente

### Mejora 17: Editar y archivar avisos

ANALIZA: Los avisos solo se creaban, no se corregían ni archivaban; las lecturas podían sobrescribir una edición simultánea y el borrador de creación compartía ámbito con todo el historial. CONFIGURA: Notificaciones reúne creación publicada/borrador, edición, archivo y recuperación como borrador, filtros/paginación y hasta 50 versiones sin truncarlas. Corregir mensaje/destinatario o volver a publicar marca pendiente de lectura. Solo el profesor recibe versiones/lectores anteriores. SQL con revisión y combinación atómica de lecturas evita sobrescrituras; validación de título, mensaje y grupo. El formulario nuevo conserva su borrador al gestionar otro aviso. TESTEA: Seis escenarios API nuevos, 38 verificaciones de avisos/seguridad y 230 pruebas completas; renderizado de creación, historial, archivo y páginas, tipos/lint correctos

### Mejora 18: Exportar reportes

ANALIZA: Los resultados necesitaban descarga con los filtros completos. El simulador guarda intentos completed; los reportes deben reconocer completed y finalized, excluir abiertos y conservar las notas cero. CONFIGURA: Reportes descarga XLSX real con hojas Estudiantes, Intentos y Filtros: notas numéricas, textos literales, grupo actual e histórico, fecha Ecuador, todas las páginas del filtro, sin claves ni revisión de preguntas. PDF real paginado con tipografía Unicode incrustada, encabezados y pie. Solo se usan los datos autorizados del profesor en su navegador, sin cargas externas. pdf-lib/fontkit se cargan al descargar; fuentes y licencias se conservan. Caracteres que la fuente no cubre muestran error y conservan alternativa Excel. Este reporte no exporta el proyecto ni migra datos. TESTEA: Cuatro escenarios de exportación, 21 verificaciones de reportes/exámenes reales y 234 pruebas completas; XLSX reabierto con lector independiente, PDF parseado y tres páginas renderizadas e inspeccionadas, controles por renderizado; tipos/lint correctos


## Mejora 19: Consulta de documentos y audio — 2026-10-05

ANALIZA: La descarga privada no permitía estudiar PDF, infografías o audio dentro de materiales y lecciones. El visor debe conservar la autorización y permitir adelantar el audio.

CONFIGURA: Ver PDF con páginas renderizadas por PDF.js, Ver imagen y Escuchar audio junto a Descargar, en ambas áreas, recursos y cursos. La apertura comprueba sesión, publicación, plan, grupo y periodo antes de consultar R2. Metadatos y MIME provienen del inventario validado; rangos simples 206/416 e If-Range para audio, cabeceras privadas y nombres seguros. PDF carga solo al abrir, limita páginas y tamaño de lienzo; no usa marcos ni cambia CSP. Word se descarga. Los archivos, datos e historial se conservan.

TESTEA: Cuatro escenarios nuevos, 23 verificaciones específicas y 238 pruebas completas; cinco renderizados de controles, tipos y lint correctos. Revisión visual en navegador pendiente. Sites conserva D1, R2, audiencia, perfiles e historial; no se exporta ni migra el proyecto.


## Mejora 20: Progreso de práctica por tema — 2026-10-05

Las veinte mejoras de IMPROVEMENTS.md están implementadas y verificadas con pruebas automatizadas. Esto no declara candidata a V1: aún quedan revisión visual manual de escritorio/móvil y verificación del contenido académico real. Las pruebas de API usan SQLite aislada; no se insertan estudiantes, preguntas o intentos de prueba en producción.

ANALIZA: La práctica comprobaba las respuestas pero no conservaba el avance. Era necesario distinguir selecciones completas de parciales y evitar contadores duplicados, datos falsificados o progreso de otro integrante.

CONFIGURA: Prácticas privadas en D1 mediante practice_session, asociadas al perfil y grupo, área, materia y periodo. Se registran desde la primera respuesta con selección validada de 1 a 100 preguntas aprobadas. Solo el servidor calcula aciertos; las respuestas iniciales son inmutables e idempotentes. Completa al comprobar toda la selección y repetir inicia otra práctica. Snapshots de preguntas, perfil, grupo, periodo y planes protegen altas y respuestas con SQL/CAS; cambios de contenido exigen una nueva práctica conservando el avance. GET entrega solo resúmenes propios por tema/formato, sin respuestas ni hashes. Tu progreso aparece junto a la selección, se actualiza al comprobar y persiste al recargar. La vista previa no guarda. Simuladores, exámenes y sus notas se conservan.

TESTEA: Siete escenarios API nuevos, 36 verificaciones de práctica/exámenes/temas y 245 pruebas completas; tres renderizados de progreso y controles, tipos y lint correctos. Revisión visual en navegador pendiente. Sites conserva D1, R2, audiencia, perfiles e historial; no se exporta ni migra el proyecto.


## Segunda ronda con archivos reales — 2026-10-06

El propietario confirmó haber terminado el testeo manual previo. Se creó una ronda adicional reproducible con 28 archivos válidos/negativos, 80 preguntas mixtas, cargas privadas, ambas áreas, temas, prácticas, finales por bloques y materias, recursos/cursos y reportes. Incluye límites reales de 100 preguntas de práctica y 200 de examen. Se detectó y corrigió la coerción de respuestas vacías a A; 16 escenarios nuevos y 261 pruebas completas aprobaron, con tipos/lint correctos. Evidencia y alcance en QA_SECOND_ROUND.md. La navegación visual informada pertenece al propietario; el agente no repitió navegador en esta ronda. Los datos son sintéticos en SQLite/R2 de ensayo, con cero inserciones QA en producción. Pendiente verificar cobertura y corrección del contenido académico real antes de declarar candidata a V1 o abrir una nueva fase de exportación.
