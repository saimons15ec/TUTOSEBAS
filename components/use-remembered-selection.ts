"use client";
import { useState, type Dispatch, type SetStateAction } from 'react';
import { readSelection, writeSelection } from '@/lib/navigation';
export function selectionStorage() { try { return typeof window === 'undefined' ? undefined : window.sessionStorage; } catch { return undefined; } }
export function useRememberedSelection<T extends string>(key: string, fallback: T, allowed?: readonly T[]): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readSelection(selectionStorage(), key, fallback, allowed));
  const remember: Dispatch<SetStateAction<T>> = next => { if (typeof next !== 'function') { writeSelection(selectionStorage(), key, next); setValue(next); } else setValue(previous => { const value = next(previous); writeSelection(selectionStorage(), key, value); return value; }); };
  return [value, remember];
}
