import { QUESTION_FORMATS, type BlockQuestion, type QuestionFormat } from "./question-blocks.ts";

export type QuestionTemplateFormat = QuestionFormat | "Mixto";

export const QUESTION_FORMAT_GUIDES: Record<QuestionTemplateFormat, string> = {
  Mixto: "Combina los cinco formatos e indica el formato de cada pregunta. Usa contexto separado para los casos prácticos.",
  "Selección directa": "Enunciado concreto y cuatro respuestas completas, con una sola clave.",
  Completar: "Enunciado con espacios en blanco; cada alternativa completa todos los espacios en orden.",
  Relacionar: "Dos listas identificadas dentro del enunciado; cada alternativa contiene la combinación completa de pares.",
  Ordenar: "Elementos o pasos numerados en el enunciado; cada alternativa contiene una secuencia completa.",
  "Caso práctico": "Contexto del caso separado de la pregunta de análisis; cuatro decisiones o soluciones completas.",
};

export function questionTemplateExamples(format: QuestionTemplateFormat): BlockQuestion[] {
  if (format === "Mixto") return QUESTION_FORMATS.map((item, index) => ({ ...questionTemplateExamples(item)[0], prompt: questionTemplateExamples(item)[0].prompt.replace("Ejemplo 1:", `Ejemplo ${index + 1}:`), importRow: index + 2 }));
  const common = { format, source: "Reemplaza por tu material, página o sección.", explanation: "Reemplaza por la justificación académica de la clave.", caseContext: "", shuffleOptions: true, importRow: 1 };
  const example = format === "Completar" ? { prompt: "Ejemplo: La observación debe acompañarse de un ______ de los cambios.", options: ["registro", "supuesto", "descuido", "resumen inventado"], correctIndex: 0 }
    : format === "Relacionar" ? { prompt: "Ejemplo: Relaciona las dos listas.\nLista 1: 1. Observar. 2. Registrar.\nLista 2: a. Anotar datos. b. Examinar cambios.", options: ["1-b; 2-a", "1-a; 2-b", "1-a; 2-a", "1-b; 2-b"], correctIndex: 0, shuffleOptions: false }
    : format === "Ordenar" ? { prompt: "Ejemplo: Ordena las etapas.\n1. Comunicar los resultados.\n2. Registrar la observación.\n3. Preparar los materiales.", options: ["3 → 2 → 1", "1 → 2 → 3", "2 → 1 → 3", "3 → 1 → 2"], correctIndex: 0, shuffleOptions: false }
    : format === "Caso práctico" ? { caseContext: "Ejemplo: Un grupo observa semillas en dos recipientes. Solo cambia la cantidad de agua y registra los cambios diarios.", prompt: "Ejemplo: ¿Qué decisión permite comparar los resultados?", options: ["Mantener las demás condiciones iguales y revisar los registros.", "Cambiar todas las condiciones al mismo tiempo.", "Omitir las observaciones que no coincidan con la idea inicial.", "Concluir sin consultar los datos."], correctIndex: 0 }
    : { prompt: "Ejemplo: ¿Qué actividad permite comparar cambios observados?", options: ["Registrar datos bajo condiciones controladas.", "Copiar una definición sin observar.", "Cambiar todas las condiciones sin registrarlas.", "Concluir antes de observar."], correctIndex: 0 };
  return [1, 2].map(index => ({ ...common, ...example, prompt: example.prompt.replace("Ejemplo:", `Ejemplo ${index}:`), importRow: index + 1 }));
}

export function questionTemplateWordText(format: QuestionTemplateFormat, metadata: { subject?: string; topic?: string } = {}) {
  const heading = `TUTOSEBAS · Plantilla de ${format}\nMateria: ${metadata.subject || "Selecciona la materia al importar"}\nTema: ${metadata.topic || "Selecciona el tema al importar"}\n${QUESTION_FORMAT_GUIDES[format]}\nSustituye los ejemplos por tus preguntas. Duplica la estructura hasta 100 preguntas.\n`;
  return heading + "\n" + questionTemplateExamples(format).map((question, index) => [
    `Pregunta ${index + 1}: ${question.format === "Caso práctico" ? "" : question.prompt}`,
    `Formato: ${question.format}`, ...(question.caseContext ? [`Contexto: ${question.caseContext}`, `Enunciado: ${question.prompt}`] : []),
    ...question.options.map((option, i) => `Alternativa ${String.fromCharCode(65 + i)}: ${option}`),
    `Correcta: ${String.fromCharCode(65 + question.correctIndex)}`, `Explicación: ${question.explanation}`, `Fuente: ${question.source}`, `Mezclar alternativas: ${question.shuffleOptions ? "Sí" : "No"}`,
  ].join("\n")).join("\n\n");
}

export function questionTemplateCsv(format: QuestionTemplateFormat) {
  const contextColumn = format === "Caso práctico" || format === "Mixto";
  const columns = ["pregunta", "opcion_a", "opcion_b", "opcion_c", "opcion_d", "correcta", "explicacion", "formato", ...(contextColumn ? ["contexto"] : []), "fuente", "mezclar_alternativas"];
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = questionTemplateExamples(format).map(question => [question.prompt, ...question.options, String.fromCharCode(65 + question.correctIndex), question.explanation, question.format, ...(contextColumn ? [question.caseContext] : []), question.source, question.shuffleOptions ? "Sí" : "No"]);
  return "\uFEFF" + [columns, ...rows].map(row => row.map(quote).join(";")).join("\r\n") + "\r\n";
}

export function questionTemplateSlug(format: QuestionTemplateFormat) { return format.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "_"); }
