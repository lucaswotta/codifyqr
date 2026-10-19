import { readPref, writePref } from './dom';

export type ThemeChoice = 'auto' | 'light' | 'dark';

export function currentTheme(): ThemeChoice {
  const stored = readPref('codifyqr.theme');
  return stored === 'light' || stored === 'dark' ? stored : 'auto';
}

export function applyTheme(choice: ThemeChoice): void {
  if (choice === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', choice);
  writePref('codifyqr.theme', choice);
}

export function nextTheme(choice: ThemeChoice): ThemeChoice {
  return choice === 'auto' ? 'light' : choice === 'light' ? 'dark' : 'auto';
}
