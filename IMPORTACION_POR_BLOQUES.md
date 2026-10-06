# TUTOSEBAS — Preguntas por bloques y temas

Alcance autorizado el 2026-10-03: contenidos preparados e importación por bloques, sin API de IA. La plataforma valida, organiza y guarda preguntas; no inventa sus respuestas. Word y PDF sirven para leer preguntas ya preparadas con sus claves; un material de estudio sin preguntas no se convierte automáticamente en un banco.

## Organización

Área → materia → tema → periodo → bloque → preguntas. Complexivos y Fin de Carrera admiten los cinco formatos y bloques mezclados. Un bloque pertenece a una sola materia, tema y periodo; para otro tema importa otro bloque. Puedes tener varios bloques del mismo tema.

Ejemplo: Complexivos / Didáctica Ciencias Naturales / Tema 1 / 2026-2027 / Bloque 1 / 20 preguntas. La materia ya existe: no crear otra con un nombre parecido.

## Carga

1. Abre Banco de preguntas o el área de la materia y pulsa **Importar bloque**.
2. Selecciona área, materia y un tema del catálogo común; puedes crear el tema desde el diálogo. Escribe el nombre del bloque y elige Mixto o un formato por defecto. El periodo vigente se asigna a todo el bloque.
3. Vincula un material de la misma materia, tema y periodo si existe y escribe una fuente común. Cada fila puede tener su propia fuente y referencia.
4. Selecciona el formato y descarga la plantilla Excel/CSV o Word correspondiente. Mixto incluye ejemplos de los cinco formatos y exige formato explícito por pregunta; las plantillas individuales conservan un formato por defecto. Completa una pregunta por fila de tabla o por sección del Word. Carga .xlsx, .csv, .docx o PDF con texto seleccionable; también puedes pegar la tabla o el texto preparado.
5. Pulsa **Analizar bloque**. Revisa las cantidades por formato y abre las filas para comprobar contexto, enunciado, alternativas, clave, explicación y fuente.
6. El texto o tabla extraídos aparecen en un campo editable. Corrige allí, en el archivo original o en el banco después de guardar y vuelve a analizar. Las repetidas ya registradas se muestran y omiten; las repetidas dentro del propio bloque se deben corregir.
7. Guarda las preguntas pendientes. Si falla una escritura, el bloque completo se revierte; no queda una importación parcial. Reintentar exactamente el mismo bloque no crea copias.

Formatos de archivo: .docx (párrafos o una sola tabla de preguntas), PDF con texto, .xlsx (primera hoja), .csv, .tsv y .txt. Máximo 100 preguntas por bloque, 2 MB por archivo, 1 MB de texto extraído y 8 MB descomprimidos en Office. PDF: hasta 60 páginas, todas con texto legible; una página sin texto bloquea la extracción para evitar omitir preguntas escaneadas. El lector se ejecuta en el navegador con su worker incluido en el sitio; no envía el documento a un proveedor de IA.

No se admite Word antiguo .doc (guardar como .docx), Excel .xls, archivos cifrados, macros ni objetos incrustados. PDF escaneado o preguntas en imágenes requieren OCR previo y revisión. Diseños de varias columnas, tablas visuales en PDF o letras usadas en listas deben comprobarse en la vista previa; no se garantiza lectura de cualquier diseño. No se inventan claves ausentes.

## Word y PDF con preguntas

Usa la plantilla Word. Puedes guardar ese mismo documento como PDF con texto. Cada pregunta comienza con `Pregunta 1:`, `Pregunta 2:` y así sucesivamente. Formato, contexto, clave, explicación y fuente usan etiquetas; las alternativas se escriben como `Alternativa A:` hasta `Alternativa D:` para distinguirlas de las listas de relacionar. También se admiten números `1.` y alternativas `A)` en documentos simples, pero la plantilla explícita evita ambigüedades.

```text
Pregunta 1: ¿Qué actividad permite observar la germinación?
Formato: Selección directa
Alternativa A: Registrar los cambios de semillas bajo condiciones controladas.
Alternativa B: Copiar la definición sin observar semillas.
Alternativa C: Mezclar todas las condiciones sin registrarlas.
Alternativa D: Concluir antes de comenzar la observación.
Correcta: A
Explicación: La observación y el registro permiten comparar cambios.
Fuente: Guía de ciencias naturales, Tema 1, sección de germinación.
```

En casos prácticos añade `Contexto:` con la situación y `Enunciado:` con la pregunta. Mantén listas y secuencias en el enunciado, antes de las alternativas. La fuente por pregunta puede omitirse si defines una fuente común válida para el bloque. La revisión académica de las claves sigue siendo responsabilidad del profesor.

## Columnas

| Columna | Regla |
| --- | --- |
| pregunta | Obligatoria; enunciado, listas o pasos, hasta 2.000 caracteres |
| opcion_a, opcion_b, opcion_c, opcion_d | Cuatro alternativas completas y distintas, hasta 500 caracteres cada una |
| correcta | Una sola clave: A, B, C, D o 1, 2, 3, 4 |
| explicacion | Obligatoria; justifica la respuesta, hasta 2.000 caracteres |
| formato | Opcional; usa el formato común si está vacía |
| contexto | Obligatoria para Caso práctico, hasta 4.000 caracteres |
| fuente | Opcional si hay fuente común; cada pregunta necesita una referencia, hasta 500 caracteres |
| mezclar_alternativas | Opcional; Sí o No. El sistema conserva además las referencias a letras u orden |

Una pregunta de relacionar no se convierte en selección directa solo por su etiqueta: deben estar las dos listas y las cuatro combinaciones completas. Las secuencias deben estar completas en cada alternativa de ordenar. Conserva los saltos de línea dentro de la celda de Excel o entre comillas en CSV. En CSV una comilla interna se escribe dos veces.

| Formato | Enunciado / contexto | Alternativas |
| --- | --- | --- |
| Selección directa | Pregunta concreta | Cuatro respuestas posibles |
| Completar | Enunciado con espacios | Cuatro soluciones completas, en orden si hay varios espacios |
| Relacionar | Dos listas identificadas | Cuatro conjuntos de pares, uno correcto |
| Ordenar | Pasos o elementos identificados | Cuatro secuencias completas, una correcta |
| Caso práctico | Situación en contexto y pregunta de análisis | Cuatro decisiones o soluciones, una correcta |

Este motor corrige una opción entre cuatro. No corrige ensayos, varias claves por pregunta o pares arrastrados uno a uno. Se puede expresar una relación o secuencia como una alternativa completa y conservar su estructura académica.

## Revisión y correcciones

En Banco de preguntas, **Bloques importados → Revisar preguntas del bloque** filtra el banco completo del bloque. Hay diez preguntas por página: revisa todas las páginas. **Editar** permite corregir enunciado, contexto, formato, alternativas, clave, explicación y fuente sin cargar otra pregunta. Guardar una corrección vuelve a pendiente su revisión y la del bloque.

Después de revisar todas las preguntas, marca la confirmación del bloque y pulsa **Aprobar bloque revisado**. Un material vinculado debe estar publicado. Preguntas archivadas o marcadas para reformular bloquean la aprobación conjunta; resuélvelas individualmente. Los estudiantes solo reciben preguntas aprobadas y no reciben el registro administrativo del bloque ni la clave durante el intento.

La identidad para duplicados compara enunciado y contexto dentro de la misma área, materia y periodo; espacios y mayúsculas no crean copias. Dos casos con la misma pregunta de análisis y contextos distintos se conservan como preguntas distintas. Cambiar la clave o las alternativas de una pregunta existente se hace con Editar.

## Simulador aplicado

Los bloques alimentan un solo banco de la materia. Un bloque de 20 preguntas no obliga a crear 20 intentos ni un simulador por bloque.

- La práctica libre permite seleccionar tema, formato y cantidad (1–100), y sortear una muestra sin repeticiones del banco aprobado. La explicación se muestra después de cada respuesta.
- El simulador individual sortea de 5 a 100 preguntas aprobadas de la misma materia y periodo. Las nuevas configuraciones proponen incluir cada tema y repartir la cantidad entre ellos, respetando la capacidad del banco. El total debe alcanzar para al menos una pregunta por tema.
- **Todos los temas** incorpora el banco aprobado completo de la materia.
- Seleccionar **Tema 1** o varios temas limita el banco. Con reparto por temas se calcula una cantidad por cada uno; con sorteo del conjunto se elige del banco sin cuotas. Los formatos pueden seleccionarse en ambas modalidades, con variedad, cantidades exactas o sorteo del conjunto.
- **Reparto por formato**: Variedad garantiza al menos una de cada estructura elegida; Cantidades exactas asigna cantidades cuya suma debe igualar el total; Sortear del conjunto conserva el sorteo sin cuotas de estructura. Con Todos los formatos, Variedad usa los que tienen banco compatible aprobado.
- Si hay menos preguntas aprobadas que la cantidad configurada, la publicación o el inicio se bloquean con un aviso. También se rechazan repartos de temas y formatos que no puedan coexistir; se informa del formato faltante o del conflicto entre grupos.
- El examen final ofrece **Bloques y temas**: selecciona hasta 30 bloques de la misma área y periodo, incluso de materias diferentes. Asigna de 1 a 100 preguntas a cada bloque, hasta 200 en total y sin superar las aprobadas disponibles. Por ejemplo, Tema 1/bloque A: 10, Tema 2/bloque B: 5 y otra materia/bloque C: 5 producen 20 preguntas.
- El modo **Materias completas** permite de 1 a 100 preguntas por materia, hasta 30 materias y 200 en total. Las nuevas configuraciones incluyen todas las materias del área y activan **Cubrir todas las materias del área**; la publicación y el inicio rechazan materias faltantes. Desactivar esta opción permite una evaluación parcial. Las configuraciones anteriores se conservan hasta editarlas. No se mezclan ambas modalidades en el mismo examen. Reparto por formato permite variedad o cantidades exactas, también cuando los bloques seleccionados son mixtos.
- Ruta: **Simuladores → Crear examen final → Bloques y temas → seleccionar bloques y cantidades → Guardar borrador → Publicar**. Al publicar y al iniciar se vuelve a verificar que cada bloque existe, pertenece al área y periodo, su materia está activa y hay suficientes preguntas aprobadas. No se rellenan faltantes con preguntas de otros bloques.
- La lectura del documento y la importación no publican el examen: primero revisa y aprueba las preguntas. Editar un examen lo devuelve a borrador. Quitar una materia archiva su contenido y elimina sus bloques de la distribución; el examen restante vuelve a borrador o se archiva si queda vacío.
- Preguntas y alternativas pueden mezclarse. Referencias como “A y B”, “todas las anteriores” o indicaciones explícitas No conservan el orden; la clave se adapta al orden de las restantes.
- Casos, listas, secuencias y saltos de línea permanecen visibles. La nota se calcula en servidor sobre 20 y la corrección aparece al finalizar.
- Editar el banco después no altera las preguntas ni resultados de intentos ya iniciados o finalizados.

## Verificación técnica

La suite `npm run test:topics` verifica el catálogo compartido, orden numérico, conservación de archivos e intentos, cambios de nombre/orden, transacciones fallidas, concurrencia, compatibilidad de bloques mixtos y filtros SQL de simulador después de renombrar. Word/CSV mixtos conservan los cinco formatos y sus contextos; una fila sin formato explícito no se guarda en modo Mixto.

Ejecutar `npm run test:security`, `npm run test:blocks`, `npm run test:documents`, `npm run test:formats`, `npm run test:resources`, comprobación TypeScript, lint y construcción mediante el flujo de Sites. Las pruebas de bloques usan Excel real con celdas inline y shared strings y SQLite para probar los mismos INSERT/UPDATE y el batch transaccional, incluidos fallos y concurrencia. Las pruebas de documentos usan DOCX real y PDF real leído por PDF.js; verifican los cinco formatos, claves, casos, documentos ambiguos, escaneos y límites. La suite de bloques comprueba el sorteo SQL por identificador de bloque, cantidad exacta, aislamiento de área/periodo, corrección y privacidad. El tamaño serializado de la sesión se limita a 1,5 MB; los exámenes con casos muy largos pueden necesitar menos preguntas.

La validación académica y el recorrido de interfaz con el primer bloque real deben hacerse antes del uso del grupo. Esta función no declara candidata a V1 ni completa el despliegue independiente.


## Ejemplo de organización

Ciencias Naturales tiene cinco temas. Por cada tema se pueden cargar varios bloques: uno de Completar, otro de Relacionar y otro mixto. El campo formato de cada pregunta prevalece sobre el formato por defecto del diálogo, para permitir bloques mezclados.

- Práctica: Tema 2, Relacionar, 10 preguntas; muestra aleatoria del mismo tema y formato.
- Simulador de Ciencias: 20 preguntas, todos sus temas y formatos, con reparto de 4 por tema si hay suficientes en los cinco.
- Examen final del área: todas las materias activas, con las cantidades asignadas a cada materia o bloque, mezclando temas y estructuras según lo elegido. Para tomar exactamente 5 de Completar y 5 de Relacionar, configura Cantidades exactas por formato y asigna 5 a cada uno; sus bloques pueden ser mixtos.

Las cuotas por bloque controlan el bloque completo. Reparto por formato agrega cuotas globales compatibles con esas cantidades, incluso para bloques mixtos; no obliga a que cada bloque contenga todos los formatos. La práctica sirve para repasar con explicación inmediata; el simulador y el examen final corrigen al finalizar y guardan su intento e historial. Los filtros y cuotas de cada intento se conservan junto a su instantánea.
