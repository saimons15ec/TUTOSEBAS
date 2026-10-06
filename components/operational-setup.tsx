"use client";

import { useState } from "react";
import { AlertTriangle, BookOpenCheck, CheckCircle2, ChevronRight, ClipboardCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildOperatingOverview, type OperatingArea, type OperatingProfile, type OperatingRecord } from "@/lib/operations";

type Props = {
  records: OperatingRecord[];
  profiles: OperatingProfile[];
  period: string;
  subjects: Record<OperatingArea, string[]>;
  go: (section: string) => void;
};

export function OperationalSetup({ records, profiles, period, subjects, go }: Props) {
  const [area, setArea] = useState<OperatingArea>("complexive");
  const overview = buildOperatingOverview(records, profiles, area, period, subjects[area]);
  const academicSection = area === "complexive" ? "complexive" : "final";
  const steps = [
    { title: "1. Revisa el grupo y sus estudiantes", text: "Hasta tres integrantes, con nombre, correo y coordinador. Si el grupo ya está registrado, comprueba sus datos antes de crear otro.", target: "students", action: "Estudiantes y grupos" },
    { title: "2. Habilita el acceso a la página", text: "El mismo correo debe estar registrado aquí y autorizado entre las personas con acceso a la página. La persona que administra esa lista debe comprobarlo antes del primer ingreso.", target: "students", action: "Revisar los correos" },
    { title: "3. Define el plan y la vigencia", text: "Bronce permite material y práctica; Plata incluye simuladores de Complexivos y entregas; Gold incluye también Fin de Carrera. Revisa la fecha de vencimiento.", target: "plans", action: "Planes y permisos" },
    { title: "4. Sube material e importa preguntas por tema", text: "Elige materia y tema, carga el material oficial y usa Importar bloque con las preguntas preparadas en Word, PDF con texto, Excel/CSV o texto pegado. Puedes cargar 20 preguntas juntas y mezclar formatos; no necesitas una API de IA para este flujo.", target: academicSection, action: "Materiales e importación" },
    { title: "5. Revisa el bloque y configura el simulador", text: "En la misma área, abre Preguntas, comprueba claves y fuentes y usa Aprobar todas o la aprobación individual. Después abre Simuladores para configurar y publicar la evaluación de esa materia o el examen final.", target: `${academicSection}:questions`, action: "Preguntas y aprobación" },
    { title: "6. Valida el primer recorrido", text: "Un estudiante debe entrar con su cuenta, abrir un material, responder y finalizar el simulador. Comprueba el resultado en Reportes y prueba una entrega si está incluida en el plan.", target: "reports", action: "Reportes" },
  ];

  return <section aria-labelledby="operational-start-title" className="space-y-5">
    <div className="rounded-[24px] border bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><p className="text-sm font-bold text-[#8a5e08]">Primer uso con estudiantes</p><h2 id="operational-start-title" className="mt-1 text-xl font-extrabold">Pon en marcha tu primer grupo</h2><p className="mt-2 text-sm leading-6 text-slate-600">Sigue estos pasos con material revisado. Los indicadores muestran lo registrado y publicado; el acceso a la página y la calidad académica requieren comprobación del profesor.</p></div>
        <Badge variant="secondary" className="self-start">{period}</Badge>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [overview.activeStudents, "Estudiantes activos", overview.invitations + " invitación(es) pendientes"],
          [overview.groupsWithActivePlan, "Grupos con plan vigente", overview.groupCount + " grupo(s) registrados"],
          [overview.realMaterials, "Materiales con archivo o enlace", "Del área seleccionada, sin muestras conocidas"],
          [overview.realQuestions, "Preguntas académicas aprobadas", "Del periodo y área seleccionados"],
        ].map(([value, label, detail]) => <div key={label} className="min-w-0 rounded-2xl bg-[#f8faf9] p-4"><p className="text-2xl font-extrabold">{value}</p><p className="mt-1 text-sm font-semibold">{label}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></div>)}
      </div>
      {overview.unassignedStudents > 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{overview.unassignedStudents} estudiante(s) registrados necesitan un grupo activo.</p>}
    </div>

    <section aria-labelledby="question-block-flow-title" className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5">
      <h3 id="question-block-flow-title" className="font-bold text-emerald-950">Preguntas por bloques, sin API de IA</h3>
      <p className="mt-2 text-sm leading-6 text-emerald-900">Las preguntas se preparan como contenido académico y se importan juntas por materia y tema. La plataforma valida las filas, omite las repetidas ya registradas y conserva contexto, formatos y respuestas. Solo las preguntas aprobadas entran en práctica y simuladores.</p>
      <p className="mt-2 text-sm leading-6 text-emerald-900">Subir un PDF de material no crea preguntas. El bloque incluye cuatro alternativas, una clave, explicación y fuente para cada pregunta. La generación desde material con IA queda como una mejora opcional futura.</p>
    </section>

    <ol className="grid gap-3 md:grid-cols-2">
      {steps.map(step => <li key={step.title} className="flex min-w-0 flex-col rounded-[22px] border bg-white p-5"><h3 className="font-bold">{step.title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{step.text}</p><Button variant="outline" className="mt-4 min-h-11 w-full justify-between whitespace-normal text-left" onClick={() => go(step.target)}>{step.action}<ChevronRight className="shrink-0"/></Button></li>)}
    </ol>

    <section aria-labelledby="academic-preparation-title" className="rounded-[24px] border bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><h3 id="academic-preparation-title" className="font-bold">Preparación por materia</h3><p className="mt-1 text-sm leading-6 text-slate-500">Elige el área con la que vas a empezar. Un recorrido preparado aún debe revisarse con la cuenta del estudiante.</p></div>
        <Select value={area} onValueChange={value => setArea(value as OperatingArea)}><SelectTrigger aria-label="Área para la puesta en marcha" className="min-h-11 w-full sm:w-52"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="complexive">Complexivos</SelectItem><SelectItem value="final_degree">Fin de Carrera</SelectItem></SelectContent></Select>
      </div>
      {(overview.sampleMaterials > 0 || overview.sampleQuestions > 0) && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700"/><div className="min-w-0"><p className="font-semibold text-amber-950">Todavía hay contenido de ensayo</p><p className="mt-1 text-sm leading-6 text-amber-900">{overview.sampleMaterials} material(es) publicados y {overview.sampleQuestions} pregunta(s) aprobadas son muestras. Revisa y sustituye esos contenidos antes del uso real. Los intentos y el historial se conservan.</p></div></div>}
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {overview.subjects.map(subject => <article key={subject.subject} className="min-w-0 rounded-2xl border p-4">
          <div className="flex items-start gap-2">{subject.ready ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700"/> : <BookOpenCheck className="mt-0.5 size-5 shrink-0 text-[#8a5e08]"/>}<h4 className="min-w-0 font-bold">{subject.subject}</h4></div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{subject.materials} material(es) con archivo o enlace · {subject.questions} pregunta(s) académicas aprobadas{subject.samples ? " · " + subject.samples + " de ensayo" : ""}</p>
          <p className={subject.ready ? "mt-3 text-sm font-semibold text-emerald-800" : "mt-3 text-sm font-semibold text-[#8a5e08]"}>{subject.next}</p>
        </article>)}
      </div>
      {!overview.subjects.length && <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Añade las primeras materias del área para organizar sus materiales y preguntas.</p>}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row"><Button className="min-h-11 bg-[#003f32]" onClick={() => go(academicSection)}><BookOpenCheck/> Revisar materiales</Button><Button variant="outline" className="min-h-11" onClick={() => go(`${academicSection}:simulators`)}><ClipboardCheck/> Configurar simuladores</Button></div>
      <p className="mt-4 text-sm leading-6 text-slate-500">Examen final: {overview.finalPublished} publicado(s) en esta área. Para crearlo, selecciona materias o bloques y asigna de 1 a 100 preguntas a cada uno, hasta 200 en total. La cobertura completa exige todas las materias activas, con banco aprobado del periodo vigente.</p>
    </section>

    <section className="rounded-[22px] border bg-[#f8faf9] p-5"><div className="flex items-start gap-3"><Users className="mt-0.5 size-5 shrink-0 text-[#8a5e08]"/><div className="min-w-0"><h3 className="font-bold">Acceso de cada estudiante</h3><p className="mt-2 text-sm leading-6 text-slate-600">Comparte el enlace después de autorizar su correo. El estudiante entra con su propia cuenta de ChatGPT y el mismo correo registrado. La vista de muestra del profesor sirve para revisar el diseño; las cuentas estudiantiles guardan entregas e intentos reales.</p></div></div></section>
  </section>;
}
