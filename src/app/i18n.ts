import { readPref, writePref } from './dom';

export const LANGS = ['en', 'pt-BR', 'es'] as const;
export type Lang = (typeof LANGS)[number];
export type Dict = Record<string, string>;

const loaders: Record<Lang, () => Promise<{ default: Dict }>> = {
  en: () => import('../locales/en.json'),
  'pt-BR': () => import('../locales/pt-BR.json'),
  es: () => import('../locales/es.json'),
};

let current: Lang = 'en';
let dict: Dict = {};
let fallback: Dict = {};

export function detectLang(): Lang {
  const stored = readPref('codifyqr.lang');
  if (stored && (LANGS as readonly string[]).includes(stored)) return stored as Lang;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const lower = tag.toLowerCase();
    if (lower.startsWith('pt')) return 'pt-BR';
    if (lower.startsWith('es')) return 'es';
    if (lower.startsWith('en')) return 'en';
  }
  return 'en';
}

export async function setLang(lang: Lang): Promise<void> {
  dict = (await loaders[lang]()).default;
  if (lang !== 'en' && Object.keys(fallback).length === 0) fallback = (await loaders.en()).default;
  current = lang;
  document.documentElement.lang = lang;
  writePref('codifyqr.lang', lang);
}

export const getLang = (): Lang => current;

export function t(key: string, params?: Record<string, string | number>): string {
  let text = dict[key] ?? fallback[key] ?? key;
  if (params) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

export const has = (key: string): boolean => key in dict || key in fallback;
