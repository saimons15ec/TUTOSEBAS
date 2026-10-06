# Mejoras secuenciales de TUTOSEBAS

Solicitud autorizada el 2026-10-04 (Guayaquil). Se aplica ANALIZA → CONFIGURA → TESTEA y se publica cada mejora antes de comenzar la siguiente. No modificar audiencia ni eliminar datos/archivos. Revisión visual en navegador pendiente: no hay navegador de pruebas soportado en este entorno.

| Orden | Mejora | Estado | Verificación |
| --- | --- | --- | --- |
| 1 | Materiales por materia y tema | Implementada y verificada | 183 pruebas, tipos, lint y compilación; publicada en v67 |
| 2 | Edición de estudiantes | Implementada y verificada | 3 escenarios API, tipos/lint; publicación a continuación; publicada en v68 |
| 3 | Requisitos de acceso | Implementada y verificada | 13 regresiones de acceso y dos renderizados estructurales; tipos/lint aprobados; publicada en v69 |
| 4 | Beneficios efectivos del estudiante | Implementada y verificada | 13 regresiones de acceso y cuatro escenarios de renderizado; tipos/lint aprobados; publicada en v70 |
| 5 | Vista previa por grupo | Implementada y verificada | 3 escenarios nuevos y 13 de permisos; tipos/lint aprobados tras corregir el contexto; publicada en v71 |
| 6 | Conservar navegación | Implementada y verificada | Tres pruebas de rutas, separación de selecciones y almacenamiento bloqueado; tipos y lint correctos.; publicada en v72 |
| 7 | Cambios sin guardar | Implementada y verificada | Tres pruebas de conservar, descartar, guardar y revertir cambios; tipos y lint correctos.; publicada en v73 |
| 8 | Guardado y doble clic | Implementada y verificada | Tres pruebas de concurrencia, recuperación y separación de solicitudes; suite completa, tipos y lint correctos.; publicada en v74 |
| 9 | Gestión de periodos | Implementada y verificada | Cuatro escenarios API nuevos y 202 pruebas completas, incluyendo concurrencia, historia, permisos, años y aislamiento; se actualizó el contexto de dos fixtures y se comprobó el catálogo histórico; tipos/lint correctos.; publicada en v75 |
| 10 | Motivos de rechazo de pagos | Implementada y verificada | Tres escenarios API nuevos y 13 regresiones de acceso; rechazos inválidos, privacidad y extensión única de 30 días comprobados; tipos/lint correctos.; publicada en v76 |
| 11 | Cola de tareas | Implementada y verificada | Tres escenarios nuevos y 11 regresiones de rutas/gestión académica; destinos, separación temporal y parámetros acotados comprobados; tipos/lint correctos.; publicada en v77 |
| 12 | Menú agrupado | Implementada y verificada | Siete pruebas de navegación/cola y dos renderizados de menú completos; todos los destinos se conservan una sola vez, avisos y aria-current correctos; tipos/lint correctos.; publicada en v78 |
| 13 | Versiones de revisiones | Implementada y verificada | Tres escenarios API nuevos, dos renderizados de cronología y 212 pruebas completas; archivos históricos, aislamiento, límites y concurrencia comprobados; tipos/lint correctos.; publicada en v79 |
| 14 | Filtros y paginación | Implementada y verificada | Seis escenarios nuevos de filtros, fechas, páginas y promedios; 13 pruebas de listas/rutas y cuatro renderizados de pantallas; tipos/lint correctos.; publicada en v80 |
| 15 | Restaurar materias | Implementada y verificada | Seis escenarios API nuevos y 224 pruebas completas: ambas áreas, archivos privados, catálogo solo, legado, conflictos de temas, permisos, concurrencia y periodo; tipos y lint correctos; publicada en v81 |
| 16 | Presentación uniforme | Implementada y verificada | Seis comprobaciones por renderizado y siete regresiones de navegación, borradores y concurrencia; tipos y lint correctos. Evaluación visual en navegador pendiente; publicada en v82 |
| 17 | Editar y archivar avisos | Implementada y verificada | Seis escenarios API nuevos, 38 verificaciones de avisos/seguridad y 230 pruebas completas; renderizado de creación, historial, archivo y páginas, tipos/lint correctos; publicada en v83 |
| 18 | Exportar reportes | Implementada y verificada | Cuatro escenarios de exportación, 21 verificaciones de reportes/exámenes reales y 234 pruebas completas; XLSX reabierto con lector independiente, PDF parseado y tres páginas renderizadas e inspeccionadas, controles por renderizado; tipos/lint correctos; publicada en v84 |
| 19 | Consulta de documentos y audio | Implementada y verificada | Cuatro escenarios nuevos, 23 verificaciones específicas y 238 pruebas completas; cinco renderizados de controles, tipos y lint correctos; publicada en v85 |
| 20 | Progreso de práctica por tema | Implementada y verificada | Siete escenarios API nuevos, 36 verificaciones de práctica/exámenes/temas y 245 pruebas completas; tres renderizados de progreso y controles, tipos y lint correctos |

## 1. Materiales por materia y tema

ANALIZA: la carga académica permitía publicar/ocultar, pero no corregir metadatos ni sustituir contenido en la misma materia.

CONFIGURA: Editar material modifica título, descripción y plan mínimo sin trasladar materia/tema. La sustitución guarda una versión anterior, devuelve el material a borrador y las preguntas aprobadas vinculadas del mismo periodo a pending. Historial de intentos intacto. Los estudiantes no reciben versiones administrativas. Límite de 100 sustituciones sin eliminar archivos.

TESTEA: cinco escenarios API nuevos, incluidos ambas áreas, derechos, publicación/descarga, historia, datos inválidos, formularios obsoletos y concurrencia. La suite completa pasa 183 pruebas; tipos y lint sin errores.

## 2. Edición de estudiantes

ANALIZA: la ficha solo permitía suspender/reactivar; corregir datos requería reutilizar el alta. CONFIGURA: Editar ficha modifica nombre, últimos cuatro dígitos, grupo y función, conservando email/auth_id/rol/estado y registros históricos. Las condiciones SQL protegen la revisión, el cupo y coordinador único en el mismo UPDATE. TESTEA: tres escenarios API verifican identidad/historia, derechos, validación, obsolescencia y límites.

## 3. Requisitos de acceso

ANALIZA: El registro interno no sustituye la lista privada de Sites; faltaba explicarlo dentro del alta.

CONFIGURA: Alta de estudiantes, Configuración e ingreso muestran dos requisitos independientes mediante AccessRequirements. El registro y la autorización externa se explican por separado; no se consulta ni modifica la audiencia automáticamente.

TESTEA: 13 regresiones de acceso y dos renderizados estructurales; tipos/lint aprobados. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 4. Beneficios efectivos del estudiante

ANALIZA: El estudiante veía su plan y vigencia, sin un inventario completo de opciones personalizadas.

CONFIGURA: Mi plan y pagos incluye Tus beneficios actuales con las 16 opciones y su estado efectivo. PlanBenefits usa canUsePlanFeature y el catálogo actualizado, con herencia, excepciones y vencimiento; explica el mínimo del contenido y permisos individuales.

TESTEA: 13 regresiones de acceso y cuatro escenarios de renderizado; tipos/lint aprobados. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 5. Vista previa por grupo

ANALIZA: La muestra Gold no permitía examinar excepciones ni grupos vencidos.

CONFIGURA: En modo Estudiante del profesor, el selector permite Gold de muestra o un grupo guardado. buildGroupPreview filtra publicación, periodo y permisos con la política compartida; excluye historia privada y progreso. El banco para simular se separa del banco visible de práctica. Las entregas, pagos y avance quedan deshabilitados; el grupo y beneficios reflejan la selección.

TESTEA: 3 escenarios nuevos y 13 de permisos; tipos/lint aprobados tras corregir el contexto. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 6. Conservar navegación

ANALIZA: La ruta y las selecciones se perdían al cambiar de pestaña o volver desde otra sección.

CONFIGURA: La navegación valida rutas según el rol, admite Atrás/Adelante y recuerda materia, tema y paso por usuario, área y periodo en sessionStorage; solo guarda selecciones de navegación.

TESTEA: Tres pruebas de rutas, separación de selecciones y almacenamiento bloqueado; tipos y lint correctos.. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 7. Cambios sin guardar

ANALIZA: Los cierres y cambios de sección podían descartar formularios editados sin aviso.

CONFIGURA: Registro temporal de borradores por formulario, aviso al cancelar o salir, guardia de navegación y beforeunload. Los diálogos detectan campos y adjuntos; planes, avisos, entregas y pagos registran su estado. Guardar limpia únicamente ese ámbito. No persiste contenido del borrador.

TESTEA: Tres pruebas de conservar, descartar, guardar y revertir cambios; tipos y lint correctos.. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 8. Guardado y doble clic

ANALIZA: Varios botones permitían reenviar una acción antes de terminar el primer envío.

CONFIGURA: Los botones con acciones asíncronas indican Procesando y bloquean clics concurrentes; los POST del panel comparten una sola operación para cuerpos equivalentes mientras están pendientes. Un fallo libera el bloqueo para reintentar.

TESTEA: Tres pruebas de concurrencia, recuperación y separación de solicitudes; suite completa, tipos y lint correctos.. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 9. Gestión de periodos

ANALIZA: Faltaba crear/activar convocatorias; algunas consultas y la gestión de materias omitían el periodo y podían afectar el histórico.

CONFIGURA: Crear periodo valida años consecutivos y lo deja en preparación. Activar cambia la selección de forma atómica con revisión, conserva contenidos e intentos y exige confirmación descriptiva. Materias, referencias, temas y cobertura de exámenes filtran por convocatoria; las altas usan el periodo vigente y condiciones SQL impiden altas durante un cambio concurrente. No se activa ninguna convocatoria real durante las pruebas.

TESTEA: Cuatro escenarios API nuevos y 202 pruebas completas, incluyendo concurrencia, historia, permisos, años y aislamiento; se actualizó el contexto de dos fixtures y se comprobó el catálogo histórico; tipos/lint correctos.. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 10. Motivos de rechazo de pagos

ANALIZA: El rechazo usaba un texto fijo y el coordinador no veía una explicación concreta.

CONFIGURA: Rechazar abre un formulario de motivo obligatorio de hasta 1000 caracteres; el servidor valida y conserva autor/fecha. Profesor y coordinador ven la nota junto al pago; los demás integrantes siguen sin recibir comprobantes. Se conserva la revisión definitiva y la renovación idempotente.

TESTEA: Tres escenarios API nuevos y 13 regresiones de acceso; rechazos inválidos, privacidad y extensión única de 30 días comprobados; tipos/lint correctos.. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 11. Cola de tareas

ANALIZA: La cola era informativa; los accesos no garantizaban llegar a la materia, tema o pestaña de evaluación adecuada.

CONFIGURA: La cola abre pagos, revisiones y tareas académicas del periodo vigente separadas por área. Los destinos incluyen materia/tema y examen final; los pasos académicos se sincronizan con la ruta y el historial. Las selecciones se guardan antes del cambio y toleran almacenamiento bloqueado. Los indicadores académicos excluyen periodos anteriores.

TESTEA: Tres escenarios nuevos y 11 regresiones de rutas/gestión académica; destinos, separación temporal y parámetros acotados comprobados; tipos/lint correctos.. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 12. Menú agrupado

ANALIZA: El menú continuo hacía difícil distinguir gestión académica, grupos y seguimiento.

CONFIGURA: El profesor ve Inicio, Gestión académica, Grupos y acceso, Seguimiento y Cuenta; el estudiante ve Inicio, Estudio, Trabajos, Mi grupo, Cuenta y avisos. Un componente compartido mantiene las mismas rutas y avisos en escritorio/móvil, con destino activo accesible y controles de vista de al menos 44 px.

TESTEA: Siete pruebas de navegación/cola y dos renderizados de menú completos; todos los destinos se conservan una sola vez, avisos y aria-current correctos; tipos/lint correctos.. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 13. Versiones de revisiones

ANALIZA: Enviar otra versión reemplazaba la referencia anterior y la descarga histórica dejaba de estar disponible.

CONFIGURA: Las solicitudes guardan hasta 200 eventos de entrega/revisión con versión, autor, fecha, archivo, notas y plazo, sin truncarlos. Reenviar limpia la corrección actual y conserva la anterior en la cronología. Las revisiones exigen versión actual y CAS; nuevas entregas protegen la solicitud/permisos. Profesor y grupo ven la cronología; archivos históricos y reconciliación validan sus enlaces. El legado conserva solamente la última versión disponible, sin inventar anteriores.

TESTEA: Tres escenarios API nuevos, dos renderizados de cronología y 212 pruebas completas; archivos históricos, aislamiento, límites y concurrencia comprobados; tipos/lint correctos.. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 14. Filtros y paginación

ANALIZA: Las listas extensas carecían de filtros homogéneos; los reportes podían tratar intentos abiertos como notas de cero.

CONFIGURA: Estudiantes, grupos, pagos, revisiones, entregas y reportes incorporan búsqueda sin diferencias de acentos, estado/grupo/fechas según el módulo y páginas de 10/20/50 registros. Reportes agrega periodos, resúmenes del filtro y calificaciones finalizadas válidas, preservando los ceros reales. Fechas SQLite se interpretan como UTC y se muestran/filtran en Ecuador. La cola abre los filtros pendientes/activos. El filtrado y las páginas operan sobre los registros autorizados ya cargados.

TESTEA: Seis escenarios nuevos de filtros, fechas, páginas y promedios; 13 pruebas de listas/rutas y cuatro renderizados de pantallas; tipos/lint correctos.. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 15. Restaurar materias

ANALIZA: Quitar materias archivaba sus contenidos sin una recuperación guiada; la recuperación debe conservar historia y evitar publicaciones automáticas o cambios en otra convocatoria.

CONFIGURA: Gestionar materias permite Restaurar y recuperar contenidos más tarde. Catálogo activo, materiales/simuladores en borrador, preguntas/bloques pendientes; archivos e intentos intactos. Los exámenes recuperan sus cuotas anteriores solo si no se editaron después. Conflictos de temas, revisiones concurrentes y cambios de periodo bloquean la operación. Materias archivadas exigen restauración explícita.

TESTEA: Seis escenarios API nuevos y 224 pruebas completas: ambas áreas, archivos privados, catálogo solo, legado, conflictos de temas, permisos, concurrencia y periodo; tipos y lint correctos. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 16. Presentación uniforme

ANALIZA: Controles compactos, ventanas largas y selección de archivos con input oculto dificultaban el uso móvil y por teclado; el grupo duplicaba una parte de la gestión de accesos.

CONFIGURA: Botones, entradas, selectores y pestañas tienen área táctil mínima de 44 px. Textos adaptables, ventanas acotadas con desplazamiento, cierres en español y acciones que se ajustan al ancho. Selector de archivos accesible por teclado con formatos, límite de 25 MB y quitar selección. Los grupos conducen a Planes y permisos; la vista previa de cuenta no cierra la sesión real.

TESTEA: Seis comprobaciones por renderizado y siete regresiones de navegación, borradores y concurrencia; tipos y lint correctos. Evaluación visual en navegador pendiente. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 17. Editar y archivar avisos

ANALIZA: Los avisos solo se creaban, no se corregían ni archivaban; las lecturas podían sobrescribir una edición simultánea y el borrador de creación compartía ámbito con todo el historial.

CONFIGURA: Notificaciones reúne creación publicada/borrador, edición, archivo y recuperación como borrador, filtros/paginación y hasta 50 versiones sin truncarlas. Corregir mensaje/destinatario o volver a publicar marca pendiente de lectura. Solo el profesor recibe versiones/lectores anteriores. SQL con revisión y combinación atómica de lecturas evita sobrescrituras; validación de título, mensaje y grupo. El formulario nuevo conserva su borrador al gestionar otro aviso.

TESTEA: Seis escenarios API nuevos, 38 verificaciones de avisos/seguridad y 230 pruebas completas; renderizado de creación, historial, archivo y páginas, tipos/lint correctos. Compilación/publicación por Sites antes del siguiente paso; inspección visual nueva pendiente por falta de navegador soportado.

## 18. Exportar reportes

ANALIZA: Los resultados necesitaban descarga con los filtros completos. El simulador guarda intentos completed; los reportes deben reconocer completed y finalized, excluir abiertos y conservar las notas cero.

CONFIGURA: Reportes descarga XLSX real con hojas Estudiantes, Intentos y Filtros: notas numéricas, textos literales, grupo actual e histórico, fecha Ecuador, todas las páginas del filtro, sin claves ni revisión de preguntas. PDF real paginado con tipografía Unicode incrustada, encabezados y pie. Solo se usan los datos autorizados del profesor en su navegador, sin cargas externas. pdf-lib/fontkit se cargan al descargar; fuentes y licencias se conservan. Caracteres que la fuente no cubre muestran error y conservan alternativa Excel. Este reporte no exporta el proyecto ni migra datos.

TESTEA: Cuatro escenarios de exportación, 21 verificaciones de reportes/exámenes reales y 234 pruebas completas; XLSX reabierto con lector independiente, PDF parseado y tres páginas renderizadas e inspeccionadas, controles por renderizado; tipos/lint correctos. Compilación/publicación por Sites antes del siguiente paso; revisión visual del sitio en navegador pendiente.

## 19. Consulta de documentos y audio

ANALIZA: La descarga privada no permitía estudiar PDF, infografías o audio dentro de materiales y lecciones. El visor debe conservar la autorización y permitir adelantar el audio.

CONFIGURA: Ver PDF con páginas renderizadas por PDF.js, Ver imagen y Escuchar audio junto a Descargar, en ambas áreas, recursos y cursos. La apertura comprueba sesión, publicación, plan, grupo y periodo antes de consultar R2. Metadatos y MIME provienen del inventario validado; rangos simples 206/416 e If-Range para audio, cabeceras privadas y nombres seguros. PDF carga solo al abrir, limita páginas y tamaño de lienzo; no usa marcos ni cambia CSP. Word se descarga. Los archivos, datos e historial se conservan.

TESTEA: Cuatro escenarios nuevos, 23 verificaciones específicas y 238 pruebas completas; cinco renderizados de controles, tipos y lint correctos. Publicación por Sites antes del siguiente paso; revisión visual del sitio en navegador pendiente.

## 20. Progreso de práctica por tema

Comprobación manual pendiente: abre materiales PDF, imagen y audio desde una materia y una lección; prueba el avance del audio y las páginas del PDF en escritorio/móvil. En una cuenta estudiantil, practica una selección disponible, recarga y verifica sus contadores por tema/formato; repite y comprueba que cuenta como otra práctica. En otro integrante del grupo, el progreso debe ser independiente. Comprueba Reportes con Excel/PDF. No se declara V1 antes de estas verificaciones y la revisión del contenido real.

ANALIZA: La práctica comprobaba las respuestas pero no conservaba el avance. Era necesario distinguir selecciones completas de parciales y evitar contadores duplicados, datos falsificados o progreso de otro integrante.

CONFIGURA: Prácticas privadas en D1 mediante practice_session, asociadas al perfil y grupo, área, materia y periodo. Se registran desde la primera respuesta con selección validada de 1 a 100 preguntas aprobadas. Solo el servidor calcula aciertos; las respuestas iniciales son inmutables e idempotentes. Completa al comprobar toda la selección y repetir inicia otra práctica. Snapshots de preguntas, perfil, grupo, periodo y planes protegen altas y respuestas con SQL/CAS; cambios de contenido exigen una nueva práctica conservando el avance. GET entrega solo resúmenes propios por tema/formato, sin respuestas ni hashes. Tu progreso aparece junto a la selección, se actualiza al comprobar y persiste al recargar. La vista previa no guarda. Simuladores, exámenes y sus notas se conservan.

TESTEA: Siete escenarios API nuevos, 36 verificaciones de práctica/exámenes/temas y 245 pruebas completas; tres renderizados de progreso y controles, tipos y lint correctos. Publicación por Sites antes del siguiente paso; revisión visual del sitio en navegador pendiente.
