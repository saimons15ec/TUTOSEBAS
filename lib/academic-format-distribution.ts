import { AcademicSelectionError, normalizedAcademicFormats, planTopicCoverage } from "./academic-selection.ts";
import { QUESTION_FORMATS, type QuestionFormat } from "./question-blocks.ts";
import { matchesSimulatorRequirement, simulatorRequirements, type SimulatorRequirement } from "./final-exam-blocks.ts";

export type FormatCoverage = "pool" | "varied" | "quota";
export type FormatQuota = { format: QuestionFormat; count: number };
export function normalizedFormatSelection(data: Record<string, unknown>) {
  const mode = data.formatCoverage === undefined ? "pool" : data.formatCoverage;
  if (!["pool", "varied", "quota"].includes(String(mode))) throw new AcademicSelectionError("Selecciona variedad, cantidades por formato o sorteo del conjunto.");
  if (mode !== "quota") return { formatCoverage: mode as FormatCoverage, formatDistribution: [] as FormatQuota[] };
  const raw = data.formatDistribution, total = Number(data.count), allowed = normalizedAcademicFormats(data.formats), seen = new Set<string>();
  if (!Array.isArray(raw) || !raw.length || raw.length > QUESTION_FORMATS.length) throw new AcademicSelectionError("Indica cantidades para los formatos del examen.");
  const entries = raw.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new AcademicSelectionError("Revisa las cantidades por formato.");
    const { format, count } = item as Record<string, unknown>;
    if (typeof format !== "string" || !QUESTION_FORMATS.includes(format as QuestionFormat) || seen.has(format) || (allowed.length && !allowed.includes(format))) throw new AcademicSelectionError("Cada formato debe estar permitido y aparecer una sola vez.");
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 200) throw new AcademicSelectionError("Cada formato debe aportar entre 1 y 200 preguntas.");
    seen.add(format); return { format: format as QuestionFormat, count };
  });
  if (!Number.isInteger(total) || entries.reduce((sum, item) => sum + item.count, 0) !== total) throw new AcademicSelectionError(`Las cantidades por formato deben sumar ${total} preguntas, igual que la distribución del examen.`);
  return { formatCoverage: "quota" as const, formatDistribution: entries };
}

type Edge = { to: number; reverse: number; capacity: number; initial: number };
function addEdge(graph: Edge[][], from: number, to: number, capacity: number) {
  const edge = { to, reverse: graph[to].length, capacity, initial: capacity };
  graph[from].push(edge); graph[to].push({ to: from, reverse: graph[from].length - 1, capacity: 0, initial: 0 }); return edge;
}
function augment(graph: Edge[][], source: number, sink: number, target: number) {
  let flow = 0;
  while (flow < target) {
    const previous: ({ node: number; index: number } | null)[] = Array(graph.length).fill(null), queue = [source]; previous[source] = { node: -1, index: -1 };
    for (let cursor = 0; cursor < queue.length && !previous[sink]; cursor++) for (let index = 0; index < graph[queue[cursor]].length; index++) {
      const edge = graph[queue[cursor]][index];
      if (edge.capacity > 0 && !previous[edge.to]) { previous[edge.to] = { node: queue[cursor], index }; queue.push(edge.to); }
    }
    if (!previous[sink]) break;
    let amount = target - flow;
    for (let node = sink; node !== source; node = previous[node]!.node) amount = Math.min(amount, graph[previous[node]!.node][previous[node]!.index].capacity);
    for (let node = sink; node !== source; node = previous[node]!.node) { const parent = previous[node]!, edge = graph[parent.node][parent.index]; edge.capacity -= amount; graph[node][edge.reverse].capacity += amount; }
    flow += amount;
  }
  return flow;
}

/** A capacity graph keeps simultaneous matter/topic/block and format counts compatible. */
export function planFormatRequirements(data: Record<string, unknown>, requirements: SimulatorRequirement[], available: Record<string, number>[]): SimulatorRequirement[] {
  const selection = normalizedFormatSelection(data);
  if (selection.formatCoverage === "pool") return requirements;
  const total = requirements.reduce((sum, item) => sum + item.count, 0);
  if (!requirements.length || total < 1 || total > 200 || requirements.some(item => !Number.isInteger(item.count) || item.count < 1) || available.length !== requirements.length) throw new AcademicSelectionError("Revisa las cantidades por materia, tema o bloque.");
  const allowed = normalizedAcademicFormats(data.formats);
  const formats: string[] = selection.formatCoverage === "quota" ? selection.formatDistribution.map(item => item.format) : allowed.length ? allowed : QUESTION_FORMATS.filter(format => available.some(group => Number(group[format] || 0) > 0));
  if (!formats.length) throw new AcademicSelectionError("No hay preguntas aprobadas de los formatos elegidos.");
  const capacities = available.map(group => formats.map(format => Math.max(0, Math.min(total, Number.isInteger(group[format]) ? group[format] : 0))));
  formats.forEach((format, index) => {
    const availableCount = capacities.reduce((sum, group) => sum + group[index], 0), required = selection.formatCoverage === "quota" ? selection.formatDistribution.find(item => item.format === format)!.count : 1;
    if (availableCount < required) throw new AcademicSelectionError(`Faltan preguntas aprobadas de ${format}: necesitas ${required} y hay ${availableCount} en la selección.`);
  });
  for (let index = 0; index < requirements.length; index++) if (capacities[index].reduce((sum, count) => sum + count, 0) < requirements[index].count) throw new AcademicSelectionError(`Faltan preguntas de los formatos elegidos en ${requirements[index].blockTitle || requirements[index].topic || requirements[index].subject}.`);
  if (selection.formatCoverage === "varied" && formats.length > total) throw new AcademicSelectionError(`Necesitas al menos ${formats.length} preguntas para incluir todos los formatos elegidos.`);
  const source = 0, formatStart = 1, groupStart = formatStart + formats.length, sink = groupStart + requirements.length, graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  const supplies = formats.map((format, index) => addEdge(graph, source, formatStart + index, selection.formatCoverage === "varied" ? 1 : selection.formatDistribution.find(item => item.format === format)!.count));
  const cells = formats.map((_, formatIndex) => requirements.map((_, groupIndex) => addEdge(graph, formatStart + formatIndex, groupStart + groupIndex, capacities[groupIndex][formatIndex])));
  requirements.forEach((requirement, index) => addEdge(graph, groupStart + index, sink, requirement.count));
  let assigned = augment(graph, source, sink, selection.formatCoverage === "varied" ? formats.length : total);
  if (selection.formatCoverage === "varied") {
    if (assigned !== formats.length) throw new AcademicSelectionError("No se puede incluir cada formato con las cantidades por tema, materia o bloque. Aumenta la cantidad, ajusta el reparto o completa ese banco.");
    // Increase all format ceilings equally; scarce formats stop at their actual capacity.
    for (let ceiling = 2; ceiling <= total && assigned < total; ceiling++) { supplies.forEach(edge => edge.capacity++); assigned += augment(graph, source, sink, total - assigned); }
  }
  if (assigned !== total) throw new AcademicSelectionError("Las cantidades por formato no caben en los temas, materias o bloques elegidos. Ajusta la distribución o completa las preguntas aprobadas.");
  return requirements.flatMap((requirement, groupIndex) => formats.flatMap((format, formatIndex) => { const edge = cells[formatIndex][groupIndex], count = edge.initial - edge.capacity; return count ? [{ ...requirement, format, count }] : []; }));
}

type QuestionRow = { status: string; data: Record<string, unknown> };
export function planAcademicRequirementsFromRows(data: Record<string, unknown>, rows: QuestionRow[]) {
  let requirements = simulatorRequirements(data);
  if (data.mode === "subject" && data.topicCoverage === "balanced") {
    const topics = new Map<string, number>();
    rows.filter(row => row.status === "approved" && matchesSimulatorRequirement(row.data, data, requirements[0])).forEach(row => { const topic = String(row.data.topic || ""); topics.set(topic, (topics.get(topic) || 0) + 1); });
    requirements = planTopicCoverage(data, [...topics].map(([topic, count]) => ({ topic, count })));
  }
  const capacities = requirements.map(requirement => {
    const counts: Record<string, number> = {};
    rows.filter(row => row.status === "approved" && matchesSimulatorRequirement(row.data, data, requirement)).forEach(row => { const format = String(row.data.format || ""); counts[format] = (counts[format] || 0) + 1; }); return counts;
  });
  return planFormatRequirements(data, requirements, capacities);
}
