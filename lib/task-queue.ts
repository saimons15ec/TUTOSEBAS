type Row = { kind: string; status: string; data: Record<string, unknown> };
export function buildTaskQueue(rows: Row[], period: string) {
  const tasks: { label: string; count: number; target: string }[] = [];
  const add = (label: string, selected: Row[], target: string, evaluation?: string) => { if (!selected.length) return; const query = new URLSearchParams(); const first = selected[0]; if (first.data.subject && !['General','23 materias'].includes(String(first.data.subject))) query.set('subject', String(first.data.subject)); if (first.data.topicId || first.data.topic) query.set('topic', String(first.data.topicId || first.data.topic)); if (evaluation) query.set('evaluation', evaluation); tasks.push({ label, count: selected.length, target: target + (query.size ? '?' + query : '') }); };
  add('Pagos pendientes', rows.filter(r=>r.kind==='payment'&&r.status==='pending'), 'payments?status=pending');
  add('Revisiones activas', rows.filter(r=>r.kind==='submission'&&['received','new_version','deadline_set','in_review','changes_requested'].includes(r.status)), 'reviews?status=active_reviews');
  for (const [area, section, label] of [['complexive','complexive','Complexivos'],['final_degree','final','Fin de Carrera']]) {
    const scope = rows.filter(r=>r.data.area===area&&r.data.period===period);
    add(`Preguntas por revisar · ${label}`, scope.filter(r=>r.kind==='question'&&['pending','draft','rewrite'].includes(r.status)), `${section}:questions`);
    add(`Materiales en borrador · ${label}`, scope.filter(r=>r.kind==='resource'&&r.status==='draft'), `${section}:materials`);
    const sims = scope.filter(r=>r.kind==='simulator'&&r.status==='draft');
    add(`Simuladores en borrador · ${label}`, sims.filter(r=>r.data.mode!=='final'&&!['General','23 materias'].includes(String(r.data.subject))), `${section}:simulators`, 'subject');
    add(`Exámenes finales en borrador · ${label}`, sims.filter(r=>r.data.mode==='final'||['General','23 materias'].includes(String(r.data.subject))), `${section}:simulators`, 'final');
  }
  return tasks;
}
