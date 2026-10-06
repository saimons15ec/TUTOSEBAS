# TUTOSEBAS - Plan futuro de generación académica desde el material

Estado al 2026-10-03: plan conservado para una mejora opcional futura. El propietario decidió usar preguntas preparadas e importación por bloques de tema, sin API, como alcance vigente; consultar IMPORTACION_POR_BLOQUES.md. Esta automatización no bloquea ese flujo. La integración con IA no está implementada ni activa. El servidor actualmente solo tiene ADMIN_EMAILS configurado. No se han enviado documentos a un proveedor ni se han activado consumos de IA.

## Contrato funcional si se retoma la mejora futura

En cada materia de Complexivos y Fin de Carrera, el profesor sube el material oficial, identifica tema y periodo y recibe el contenido generado y las preguntas en las modalidades correspondientes. El trabajo manual es revisar, corregir cuando haga falta y aprobar la publicación; redactar cada producto desde cero no es el flujo principal.

Orden: subir fuente privada; validar y analizar contenido; generar productos y preguntas; revisar fuente y resultados; publicar lo aprobado; alimentar práctica, simulador individual y examen final con el banco aprobado. Una prueba funcional sobre nombres de archivos, periodos o trazabilidad no sustituye preguntas sobre el contenido de la materia.

## Salidas y criterio de realidad

| Opción | Resultado necesario | Comprobación |
| --- | --- | --- |
| Documento | Fuente original conservada y organizada | Archivo protegido abre y coincide con la fuente |
| Resumen | Síntesis basada en la fuente, con referencias | Contenido legible y fiel al documento |
| Guía de estudio | Objetivos, conceptos, actividades y orientación de estudio | Actividades corresponden al contenido y nivel |
| Infografía | Recurso visual derivado de la fuente | Se visualiza correctamente, no contiene solo un guion |
| Presentación | Diapositivas completas, consultables o descargables | Se recorren o abren todas las diapositivas |
| Audio | Audio reproducible, derivado del contenido revisado | Se escucha y el archivo queda protegido |
| Video | Video reproducible con contenido revisado | Se reproduce; un guion por sí solo no equivale a video |

Actualmente esos tipos clasifican archivos o enlaces que carga el profesor. Sus selectores no son generadores. La implementación debe mostrar el estado de cada salida y conservar la fuente, sin declarar disponible una salida que falló.

## Modalidades del banco

Las cinco modalidades existentes deben generarse desde el contenido: Selección directa, Completar, Relacionar, Ordenar y Caso práctico. Cada pregunta conserva materia, área, tema, periodo, fuente, explicación, clave y cuatro alternativas compatibles con la práctica y el simulador existentes. Caso práctico necesita contexto explícito. Relacionar y Ordenar deben plantear relaciones o secuencias reales, no cambiar únicamente la etiqueta de una pregunta directa.

Los resultados se guardan pendientes de revisión. Nunca se aprueban automáticamente por haber sido generados. El modelo no decide permisos, planes, destinatarios ni cuentas. La clave de respuesta permanece en servidor hasta la corrección correspondiente.

## ANALIZA: decisiones indispensables

1. Elegir proveedor de análisis y generación y el modelo apto para los documentos. OpenAI Responses ofrece entrada de PDF, DOCX y PPTX y salidas estructuradas; es una vía posible, no un proveedor activado. Otro proveedor requiere verificar su documentación y capacidades antes de implementarlo.
2. Determinar servicios para las salidas visuales, voz y video. Un único modelo de texto no garantiza todos los archivos multimedia. Definir límites de consumo y presupuesto del propietario antes de activar llamadas.
3. Obtener la credencial del propietario y configurar secretos en el servidor; no pedirla en mensajes ni guardarla en Git, interfaz, respaldo lógico o archivos de ejemplo.
4. Usar material académico oficial de la primera materia para la prueba. No enviar perfiles, correos, pagos, identificaciones, entregas o calificaciones estudiantiles junto con ese material.
5. Establecer política de retención y borrado de copias temporales del proveedor, conservando siempre el original privado en R2 y su historial.

## CONFIGURA: implementación en el entorno actual

1. Incorporar un adaptador de proveedor del lado del servidor, con configuración de modelos y estado que no exponga secretos.
2. Enlazar el guardado del material con un trabajo de generación persistente. Guardar identificador de fuente, huella, versión, periodo, solicitudes, estado y salidas. Validar registro y tipo de archivo antes de enviarlo.
3. Mostrar etapas y estados: esperando conexión, en cola, analizando, generando, pendiente de revisión, terminado o error. La carga del original debe conservarse si la generación falla.
4. Limitar tamaño, tiempo, cantidad de preguntas, concurrencia y consumo. Reusar resultados completos para la misma fuente y configuración. Los reintentos no deben duplicar preguntas, simuladores ni cobros por una solicitud ya completada.
5. Tratar las instrucciones dentro del documento como contenido no confiable. Pedir resultados estructurados y validar el resultado en servidor: formatos, longitudes, alternativas únicas, clave válida, contexto de casos y referencias. No ejecutar HTML, scripts, herramientas o URLs sugeridos por el material o el modelo.
6. Guardar productos aprobables como borradores, archivos privados y registros vinculados a la fuente y su versión. La revisión debe mostrar el original junto con el producto y cada pregunta.
7. Proponer automáticamente el simulador de la materia, de 5 a 15 preguntas. Comprobar publicación de la fuente, aprobación y suficiente banco antes de publicar. Preservar el límite de 5 a 15 preguntas por materia en el examen final combinado.
8. Registrar proveedor, modelo, estado y consumo sin secretos ni texto académico completo en los registros de auditoría. Mantener el adaptador portable, sin cambiar el alojamiento o los controles de acceso.

## TESTEA: pruebas de aceptación

- Caso positivo en la primera materia: una carga genera resultados reales y preguntas de las cinco modalidades, mantiene referencias y permite revisión y publicación.
- Caso equivalente en Fin de Carrera: área, materia, periodo y permisos se conservan sin mezclarse con Complexivos.
- Cada producto multimedia reproduce o abre el formato anunciado; marcar la salida fallida individualmente y permitir reintentar sin duplicar las demás.
- La repetición y dos solicitudes simultáneas no duplican resultados. Una fuente modificada no reutiliza silenciosamente los resultados antiguos.
- Credencial ausente, saldo o cuota insuficientes, límite de archivo, tiempo agotado, rechazo del proveedor y JSON incompleto generan mensajes claros y conservan el original.
- El estudiante no puede iniciar generación, ver credenciales, acceder a borradores ni consultar claves de respuestas antes de finalizar.
- Un documento con instrucciones maliciosas no modifica el flujo, ejecuta código, llama URLs ni accede a otros datos.
- Material sin contenido suficiente no produce un banco inventado. Citas, explicación, nivel y respuesta pasan revisión del profesor.
- Después de aprobar, práctica y simulador utilizan el nuevo banco; el intento guarda nota e historial en la cuenta y grupo correctos.
- Pasan las pruebas de seguridad, TypeScript, lint y compilación; se comprueba en escritorio y móvil antes de declarar completada la automatización.

## Puerta de activación

Faltan proveedor/modelos, credenciales, límite de consumo y primer documento. Cuando estén definidos, se ejecuta esta implementación siguiendo ANALIZA, CONFIGURA y TESTEA. No añadir al propietario la tarea de redactar manualmente las preguntas como solución al requisito pendiente.
