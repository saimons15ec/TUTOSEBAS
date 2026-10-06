import { resourceSections } from './additional-resources.ts';
import { canReadPublishedSupport } from './content-access.ts';
import { canUsePlanFeature, contentPlanFeature, defaultPlanCatalog, type PlanCatalog } from './plans.ts';
type Row = { id: string; kind: string; title: string; status: string; data: Record<string, unknown> };
type Person = { id: string; email: string; full_name: string; role: string; status: string; group_id?: string | null; member_role?: string };
export function buildGroupPreview<R extends Row, P extends Person>(workspace: { records: R[]; profiles: P[]; activePeriod?: string; plans?: PlanCatalog }, groupId: string) {
  const period = workspace.activePeriod || '2026-2027', catalog = workspace.plans || defaultPlanCatalog();
  const actual = workspace.records.find(row => row.kind === 'group' && row.id === groupId);
  if (groupId && !actual) throw new Error('El grupo de la vista previa ya no existe.');
  const group = actual || { id: 'preview-demo', kind: 'group', title: 'Grupo de muestra', status: 'active', data: { plan: 'Gold', planStatus: 'active', endsAt: new Date(Date.now() + 18 * 86400000).toISOString(), accessPolicyVersion: 1 } } as unknown as R;
  const people = actual ? workspace.profiles.filter(person => person.group_id === group.id) : [];
  const profile = { id: `preview:${group.id}`, email: 'vista@ejemplo.test', full_name: `Vista de ${group.title}`, role: 'student' as const, status: 'active', group_id: group.id, member_role: people.some(person => person.member_role === 'coordinator') || !actual ? 'coordinator' : 'member' };
  const sections = resourceSections(workspace.records, period);
  const rows = workspace.records.filter(row => {
    if (row.kind === 'resource_section') return row.data.period === period && ['published', 'archived'].includes(row.status);
    if (['subject', 'topic'].includes(row.kind)) return row.status === 'published' && row.data.period === period;
    if (['resource', 'course'].includes(row.kind)) return canReadPublishedSupport(row, group.data, period, catalog, sections) && (row.kind !== 'course' || Boolean(row.data.fileKey || row.data.externalUrl) || workspace.records.some(lesson => lesson.kind === 'course_lesson' && lesson.status === 'published' && lesson.data.period === period && lesson.data.courseId === row.id));
    if (!['question', 'simulator'].includes(row.kind) || row.data.period !== period || row.status !== (row.kind === 'question' ? 'approved' : 'published')) return false;
    const feature = contentPlanFeature(row, sections);
    return Boolean(feature && canUsePlanFeature(group.data, feature, catalog, row.data.plan || (row.kind === 'simulator' ? 'Plata' : 'Bronce'), row));
  });
  const courses = new Set(rows.filter(row => row.kind === 'course').map(row => row.id));
  rows.push(...workspace.records.filter(row => row.kind === 'course_lesson' && row.status === 'published' && row.data.period === period && courses.has(String(row.data.courseId))), group);
  const previewQuestionBank = workspace.records.filter(row => row.kind === 'question' && row.status === 'approved' && row.data.period === period);
  return { profile, profiles: people, records: rows, previewQuestionBank };
}
