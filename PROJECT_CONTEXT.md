# TUTOSEBAS — Contexto del proyecto

Última actualización de contexto: 2026-09-28.

## Para qué existe

TUTOSEBAS es una plataforma privada para acompañar la preparación de estudiantes en la Unidad de Integración Curricular y el examen de fin de carrera. Centraliza contenidos, práctica, simulación, trabajos, revisiones, planes y seguimiento.

Su propósito no es solo mostrar material. Debe permitir administrar quién accede, qué puede ver según su grupo y plan, cómo estudia, qué entrega y qué resultados obtiene.

## Fase actual

El proyecto está en desarrollo y pruebas dentro de ChatGPT Work / Sites. No se ha declarado V1 ni se ha iniciado la migración independiente. La fase estructural de seguridad fue revisada y reforzada; el propietario autorizó una copia privada del código en `saimons15ec/TUTOSEBAS` y respaldos privados en el Drive principal de Saimons.

La versión activa en Sites debe permanecer operativa mientras continúa el desarrollo. El repositorio interno de Sites conserva el historial de publicaciones y GitHub mantiene una copia privada del código; ninguno sustituye los datos vivos de D1 ni los binarios de R2.

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
3. El sistema enlaza el identificador estable de autenticación con el perfil existente.
4. Una invitación válida pasa a activa al iniciar sesión.
5. El nombre académico no se reemplaza por el nombre de ChatGPT.
6. Una cuenta suspendida no recupera acceso por volver a iniciar sesión.

### Grupo y plan

1. El profesor crea un grupo con nombre y código.
2. Puede asignar hasta tres estudiantes y un solo coordinador.
3. El grupo tiene plan, estado, fecha de inicio, vencimiento y permisos manuales.
4. Los permisos manuales pueden habilitar todo, un tipo, un área o un registro específico.
5. El servidor valida plan y permisos en cada operación sensible.

### Contenido y preguntas

1. El profesor crea un recurso, curso, pregunta o simulador.
2. El contenido nace como borrador o pendiente según el tipo.
3. Solo lo publicado o aprobado llega al estudiante.
4. Las preguntas contienen materia, tema, periodo, alternativas, respuesta, explicación y fuente.
5. El formato Caso práctico de Complexivos separa el contexto de la situación y la pregunta de análisis; ambos se conservan y se muestran al estudiante.
6. Una pregunta puede vincularse a un material de origen mediante su identificador estable; el servidor verifica que pertenezca a la misma área y materia.
7. Al vincularla, la pregunta conserva una referencia del título, tipo y tema del material, además de heredar su periodo y plan mínimo.
8. Una pregunta vinculada puede guardarse como pendiente mientras el material esté en borrador, pero solo puede aprobarse después de publicar ese material.

### Práctica y simulación

1. La práctica libre muestra corrección y explicación después de responder.
2. La última pregunta de la práctica se cierra con Finalizar práctica y muestra un resumen con aciertos y opción de repetir.
3. Cada área separa simuladores de práctica por materia y exámenes finales combinados.
4. Un simulador por materia toma exclusivamente entre 5 y 15 preguntas aprobadas de esa materia.
5. Un examen final permite seleccionar materias y asignar entre 5 y 15 preguntas a cada una.
6. El simulador selecciona exactamente la distribución configurada y aleatoriza preguntas y alternativas.
7. El estudiante debe responder todo antes de finalizar.
8. No se muestra la clave durante el intento.
9. La API verifica otra vez plan, distribución, preguntas, respuestas y calificación.
10. El intento guarda nota sobre 20, aprobación, duración y detalle.
11. El estudiante ve primer, último, mejor y promedio, además de la revisión final.
12. El portal del estudiante muestra únicamente materiales, preguntas y simuladores del periodo vigente; el historial permanece conservado para administración.
13. Un simulador solo puede publicarse y calificarse con preguntas de su mismo periodo.

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
- simuladores separados por área, práctica por materia y examen final con distribución de 5 a 15 preguntas por materia;
- validación de disponibilidad antes de publicar y calificación con historial de intentos;
- portal estudiantil con dos recorridos visualmente separados: estudio por materia y examen final;
- separación efectiva del periodo vigente en el portal estudiantil, sin borrar los contenidos y simuladores históricos;
- dentro de cada materia, secuencia visible de Materiales, Práctica y Simulador individual;
- trabajos, revisiones y versiones;
- avisos internos;
- reportes de simuladores por estudiante, promedios e historial de intentos;
- vista previa de estudiante para el administrador.

## Qué falta o sigue siendo parcial

- confirmar mediante prueba real el flujo completo del nuevo simulador;
- completar una prueba de extremo a extremo del simulador con una cuenta estudiantil real; la organización visual de Complexivos, Fin de Carrera, periodo vigente e histórico ya fue comprobada sin publicar ni borrar contenido;
- repetir, si se considera necesario, el ciclo positivo de publicación y aprobación con Video; la vinculación pendiente y el ciclo completo con Infografía ya fueron comprobados;
- llenar el alcance académico completo de Fin de Carrera;
- completar rutas, preguntas y simuladores de Complexivos;
- convertir el catálogo de cursos en lecciones y progreso reales si entra en V1;
- acordar el alcance de IA para V1;
- crear automatización de análisis de documentos solo cuando exista un proveedor autorizado;
- definir si V1 necesita exportación de reportes o analíticas adicionales a los simuladores;
- crear un entorno separado para ensayar una restauración completa; el paquete recuperable de D1/R2, la auditoría persistente y el límite distribuido de frecuencia ya están operativos;
- completar con una cuenta estudiantil real los recorridos integrales de autorización, móvil y recuperación de sesión; las validaciones automatizadas y los ajustes responsive ya están cubiertos;
- auditar datos y archivos antes de exportar;
- crear el paquete independiente y HANDOFF_TO_CHATGPT.md únicamente en la fase autorizada.

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

No existe conexión activa con un proveedor de IA. La interfaz explica que el análisis de PDF y la generación automática están pendientes. El verificador APA es heurístico y local; no debe describirse como IA ni como validación académica definitiva.

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
