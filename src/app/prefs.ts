import { readPref, writePref } from './dom';

/** Single-character shortcuts can be switched off (WCAG 2.1.4). Combinations with Ctrl always work. */
export const singleKeys = (): boolean => readPref('codifyqr.singlekeys') !== 'off';
export const setSingleKeys = (on: boolean): void => writePref('codifyqr.singlekeys', on ? 'on' : 'off');
