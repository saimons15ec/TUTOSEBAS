const studentSections = ['home','final','complexive','work','resources','deliveries','group','plan','notices','account'];
const adminSections = ['dashboard','students','payments','plans','periods','final','complexive','reviews','resources','notices','reports','settings'];
export function readNavigation(hash: string, administrator: boolean) {
  const [requestedMode, requestedSection, requestedStep] = hash.replace(/^#/, '').split('?')[0].split('/');
  const mode = requestedMode === 'student' || !administrator ? 'student' : 'admin';
  const sections = mode === 'admin' ? adminSections : studentSections;
  const section = sections.includes(requestedSection) ? requestedSection : mode === 'admin' ? 'dashboard' : 'home';
  const step = ['questions','simulators'].includes(requestedStep) && ['complexive','final'].includes(section) ? requestedStep as 'questions'|'simulators' : 'materials';
  return { mode: mode as 'admin'|'student', section, step: step as 'materials'|'questions'|'simulators' };
}
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
export function readSelection<T extends string>(storage: Storage | undefined, key: string, fallback: T, allowed?: readonly T[]): T {
  try { const value = JSON.parse(storage?.getItem(`tutosebas:selection:${key}`) || 'null'); return typeof value === 'string' && value.length <= 500 && (!allowed || allowed.includes(value as T)) ? value as T : fallback; } catch { return fallback; }
}
export function writeSelection(storage: Storage | undefined, key: string, value: string) { try { if (value.length <= 500) storage?.setItem(`tutosebas:selection:${key}`, JSON.stringify(value)); } catch {} }

/** Apply only bounded navigation choices; never stores answers or permissions. */
export function applyAcademicRouteScope(storage: Storage | undefined, key: string, route: string) {
  const query = new URLSearchParams(route.split('?').slice(1).join('?'));
  for (const name of ['subject','topic']) { const value = query.get(name)?.trim(); if (value && value.length <= (name === 'subject' ? 180 : 500)) writeSelection(storage, `${key}:${name}`, value); }
  const evaluation = query.get('evaluation'); if (evaluation && ['subject','final'].includes(evaluation)) writeSelection(storage, `${key}:evaluation`, evaluation);
}
