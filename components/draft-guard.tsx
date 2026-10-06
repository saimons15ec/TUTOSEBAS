"use client";
import { useEffect, useRef } from 'react';
import { DraftRegistry } from '@/lib/draft-guard';
export const drafts = new DraftRegistry();
export function confirmDrafts(ids?: readonly string[]) { return drafts.confirm(() => window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos y continuar?'), ids); }
export function activeDraft() { return typeof document === 'undefined' ? '' : document.activeElement?.closest('[data-draft-scope]')?.getAttribute('data-draft-scope') || ''; }
export function useDraftGuard(id: string, dirty: boolean, fingerprint: unknown = dirty) {
  const key = JSON.stringify(fingerprint), state = useRef({ dirty, key, saved: '' });
  useEffect(() => { state.current.key = key; state.current.dirty = dirty && key !== state.current.saved; }, [dirty, key]);
  useEffect(() => drafts.register(id, () => state.current.dirty, () => { state.current.saved = state.current.key; state.current.dirty = false; }), [id]);
}
function snapshot(root: HTMLElement) {
  return JSON.stringify([...root.querySelectorAll<HTMLElement>('input:not([type=hidden]),textarea,select,[role=combobox],[role=checkbox],[role=radio]')].map(field => [field.tagName, field.getAttribute('type'), field.getAttribute('name') || field.getAttribute('aria-label'), field instanceof HTMLInputElement && field.type === 'file' ? [...(field.files || [])].map(file => [file.name, file.size, file.lastModified]) : 'value' in field ? field.value : field.textContent, field instanceof HTMLInputElement && ['checkbox','radio'].includes(field.type) ? field.checked : field.getAttribute('aria-checked')]));
}
export function useDialogDraft(id: string, root: HTMLDivElement | null) {
  useEffect(() => {
    if (!root) return;
    let baseline = snapshot(root), interacted = false;
    const remove = drafts.register(id, () => interacted && snapshot(root) !== baseline, () => { baseline = snapshot(root); interacted = false; });
    const input = () => { interacted = true; };
    const click = (event: Event) => {
      const target = (event.target as Element).closest('button');
      if (target && /^(Cancelar|Cerrar|Volver)$/i.test(target.textContent?.trim() || '') && !confirmDrafts([id])) { event.preventDefault(); event.stopPropagation(); }
      if ((event.target as Element).closest('[role=combobox],[role=checkbox],[role=radio]')) interacted = true;
    };
    root.addEventListener('input', input, true); root.addEventListener('change', input, true); root.addEventListener('click', click, true);
    return () => { root.removeEventListener('input', input, true); root.removeEventListener('change', input, true); root.removeEventListener('click', click, true); remove(); };
  }, [id, root]);
}
export function DraftExitGuard() {
  useEffect(() => { const leave = (event: BeforeUnloadEvent) => { if (drafts.dirty()) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave); }, []);
  return null;
}
