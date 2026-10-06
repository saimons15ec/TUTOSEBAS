# Segunda ronda completa — 2026-10-06

## ANALIZA

El propietario confirmó que terminó su testeo manual y pidió crear archivos y preguntas para otra ronda amplia. Base: Sites v86. Se conserva la audiencia privada personalizada, D1/R2, el padrón y el historial. La confirmación manual del propietario se registra como evidencia informada, no como una nueva observación del agente.

Las pruebas nuevas recorren los handlers reales de plataforma y archivos sobre las migraciones reales en SQLite aislada. Un adaptador R2 conserva los bytes completos, metadatos, rangos e inventario. Los identificadores de autenticación son de ensayo. Esta ronda no equivale a una nueva sesión de navegador en producción ni a una prueba de carga concurrente del alojamiento.

## CONFIGURA

- `scripts/generate-qa-fixtures.py` genera 28 archivos reales más el manifiesto: cuatro bloques de 20 preguntas en DOCX, PDF, XLSX, CSV y TXT; PDF de lectura, PNG, WAV y Word; cuatro archivos para rechazos.
- 80 preguntas preparadas, con cuatro de cada uno de los cinco formatos por bloque. Claves A–D, contextos separados, fuentes sintéticas, explicaciones y opciones de mezcla.
- Los bloques se prueban en ambas áreas: dos materias y cuatro temas por área. Las pruebas de capacidad crean diez bloques de 20 a partir de los documentos y comprueban un final de 200 preguntas y práctica de 100.
- Solo fixtures ficticias `example.test`. Cero escrituras de datos de prueba en la producción.
- Se corrige `check_practice_answer`: solo acepta un índice numérico entero de 0 a 3. Antes, `Number(null)` y entradas similares podían convertirse en A y registrar progreso sin una respuesta válida. Se conserva la API de respuestas numéricas utilizada por la interfaz.

## TESTEA

16 escenarios nuevos y 261 pruebas totales aprobados; cero fallos, omisiones o pruebas pendientes en la ejecución automatizada. Tipos y lint correctos. La compilación de publicación debe verificarse antes de desplegar la corrección.

1. Los cinco lectores conservan los 80 enunciados, alternativas, claves, formatos, contextos, explicaciones, fuentes y opción de mezcla. El lector PDF usa la compatibilidad DOM de PDF.js para Node y el mismo extractor/worker instalado; no simula el texto extraído.
2. PDF falso, Word dañado, PDF escaneado, clave ausente, formato desconocido y bloques mayores de 2 MB rechazados.
3. Importación atómica, revisión individual y del bloque completo, reintento sin duplicación, fuente no publicada y periodo histórico.
4. PDF, imagen, WAV y Word por materia/tema: descarga byte por byte, SHA-256, visor seguro y Word solamente descargable.
5. Prácticas de cada formato, avance parcial, conclusión con 50 % de aciertos, nueva práctica y privacidad dentro del mismo grupo.
6. Simulador por materia: diez preguntas, cinco por tema y dos por formato, nota 10/20 y recuperación del mismo intento.
7. Final por bloques: veinte preguntas, cinco por bloque, cuatro por formato y nota 20/20.
8. Final por materias: ochenta preguntas y nota real 0/20 conservada. Finales de doscientas preguntas: cien por materia, cuarenta por formato y nota 10/20. Excesos de capacidad bloqueados.
9. Respuestas incompletas o de otro perfil rechazadas; clave ausente durante el intento; finalizar de nuevo conserva un solo resultado.
10. Reportes XLSX reabiertos con un lector independiente y PDF reabierto: notas reales 0/10/20, sin claves. Ejemplos exclusivamente sintéticos.
11. Sección de recursos personalizada, cuatro lecciones con archivos reales, orden, progreso propio 100 %, otro estudiante 0 %, archivo y recuperación con historial conservado.
12. Rangos de audio, múltiples rangos inválidos, plan insuficiente, plan vencido, permiso denegado, usuario suspendido, desconocido, sesión ausente y origen no confiable.
13. La regresión existente incluye cuentas/grupos/planes, materias y recuperación, temas, entregas y versiones, pagos, avisos, periodos, concurrencia, cabeceras y reportes.

## Ciclo de corrección y alcance

La prueba negativa demostró la aceptación de `null` como A. Se analizó la conversión, se exigió tipo numérico y se repitió el ciclo con once valores inválidos, con y sin sesión de práctica. Todos son rechazados sin modificar el avance; las respuestas correctas numéricas siguen funcionando. La primera expectativa del arnés sobre Word se corrigió para respetar el comportamiento existente: metadatos de visor e inline devuelven 415 y la descarga sigue permitida.

La automatización valida lógica y persistencia en consultas sucesivas de SQLite; no certifica por sí sola el navegador, la reproducción del audio en cada dispositivo, el inicio de sesión externo de Sites, el rendimiento de R2 real ni una restauración completa de producción. La revisión visual de los documentos generados es independiente de la UI de la plataforma.

Antes de uso académico: revisar contenido real, sus claves/fuentes y cobertura de materias. Mantener los fixtures QA fuera del banco académico. Esta ronda no autoriza ni ejecuta una migración o exportación del proyecto.

## Repetición

`node --experimental-strip-types --test tests/qa-real-documents.test.mjs tests/qa-complete-workflows.test.mjs`

La variable opcional `QA_EVIDENCE_DIR` escribe contadores y ejemplos de resultados sintéticos. La batería normal conserva los fixtures comprometidos en el repositorio y no requiere Python; Python solo se utiliza para regenerarlos.
