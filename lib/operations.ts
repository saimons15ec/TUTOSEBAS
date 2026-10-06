import { isPlanActive } from "./security.ts";
import { planAcademicRequirementsFromRows } from "./academic-format-distribution.ts";
import { matchesSimulatorRequirement } from "./final-exam-blocks.ts";
import { legacyTopicParts } from "./academic-topics.ts";

export type OperatingArea = "complexive" | "final_degree";
export type OperatingRecord = {
  id: string;
  kind: string;
  title: string;
  status: string;
  data: Record<string, unknown>;
  updated_at?: string;
};
export type OperatingProfile = {
  role: string;
  status: string;
  group_id?: string | null;
};

const normalized = (value: unknown) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const knownSamples = new Set([
  "infografia de prueba", "video de prueba", "audio de prueba",
  "guia de estudio de prueba", "resumen de prueb", "prueba presentacion",
]);

export function isDemonstrationContent(row: OperatingRecord) {
  const rawTopic = String(row.data.topic || "");
  const topic = normalized(legacyTopicParts(rawTopic).name || rawTopic);
  return row.data.isTest === true
    || row.data.purpose === "test"
    || knownSamples.has(normalized(row.title))
    || knownSamples.has(normalized(row.data.sourceMaterialTitle))
    || (/^ejemplo \d+:/i.test(String(row.data.prompt || "")) && String(row.data.source || "") === "Reemplaza por tu material, página o sección.")
    || topic === "tema de prueba"
    || /^prueba funcional\b/.test(topic);
}

function hasMaterialAccess(row: OperatingRecord) {
  if (typeof row.data.fileKey === "string" && row.data.fileKey.trim()) return true;
  try {
    const url = new URL(String(row.data.externalUrl ?? ""));
    return ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

const isFinal = (row: OperatingRecord) => row.data.mode === "final" || ["General", "23 materias"].includes(String(row.data.subject));

export function buildOperatingOverview(
  records: OperatingRecord[],
  profiles: OperatingProfile[],
  area: OperatingArea,
  period: string,
  subjects: string[],
  now = Date.now(),
) {
  const groups = records.filter(row => row.kind === "group" && row.status === "active");
  const groupIds = new Set(groups.map(row => row.id));
  const students = profiles.filter(profile => profile.role === "student" && ["active", "invited"].includes(profile.status));
  const current = records.filter(row => row.data.area === area && row.data.period === period);
  const materials = current.filter(row => row.kind === "resource" && row.status === "published");
  const questions = current.filter(row => row.kind === "question" && row.status === "approved");
  const realMaterials = materials.filter(row => !isDemonstrationContent(row) && hasMaterialAccess(row));
  const realQuestions = questions.filter(row => !isDemonstrationContent(row));
  const sampleQuestions = questions.filter(isDemonstrationContent);
  const simulators = current.filter(row => row.kind === "simulator" && row.status !== "archived");

  return {
    activeStudents: students.filter(profile => profile.status === "active").length,
    invitations: students.filter(profile => profile.status === "invited").length,
    unassignedStudents: students.filter(profile => !profile.group_id || !groupIds.has(profile.group_id)).length,
    groupCount: groups.length,
    groupsWithActivePlan: groups.filter(row => ["Bronce", "Plata", "Gold"].includes(String(row.data.plan)) && isPlanActive(row.data.planStatus, row.data.endsAt, now)).length,
    realMaterials: realMaterials.length,
    realQuestions: realQuestions.length,
    sampleMaterials: materials.filter(isDemonstrationContent).length,
    sampleQuestions: sampleQuestions.length,
    finalPublished: simulators.filter(row => isFinal(row) && row.status === "published").length,
    subjects: subjects.map(subject => {
      const subjectMaterials = realMaterials.filter(row => row.data.subject === subject).length;
      const subjectQuestions = realQuestions.filter(row => row.data.subject === subject).length;
      const subjectSamples = sampleQuestions.filter(row => row.data.subject === subject).length;
      const simulator = simulators.filter(row => !isFinal(row) && row.data.subject === subject)
        .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))[0];
      const count = Number(simulator?.data.count);
      const validCount = Number.isInteger(count) && count >= 5 && count <= 100;
      let bankFits = false;
      if (simulator && validCount) {
        try {
          const requirements = planAcademicRequirementsFromRows(simulator.data, realQuestions);
          bankFits = requirements.every(requirement => realQuestions.filter(row => matchesSimulatorRequirement(row.data, simulator.data, requirement)).length >= requirement.count);
        } catch { bankFits = false; }
      }
      const ready = subjectMaterials > 0 && subjectSamples === 0 && Boolean(simulator && validCount && simulator.status === "published" && bankFits);
      const next = subjectMaterials === 0 ? "Sube un material real"
        : subjectSamples > 0 ? "Retira las preguntas de ensayo"
        : subjectQuestions < 5 ? "Aprueba al menos 5 preguntas"
        : !simulator ? "Configura el simulador"
        : !validCount ? "Revisa la cantidad de preguntas"
        : !bankFits ? "Completa temas, formatos y cantidad del banco aprobado"
        : simulator.status !== "published" ? "Publica el simulador"
        : "Preparado para validar";
      return { subject, materials: subjectMaterials, questions: subjectQuestions, samples: subjectSamples, configuredCount: validCount ? count : null, ready, next };
    }),
  };
}
