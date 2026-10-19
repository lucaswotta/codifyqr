export type Child = Node | string | number | null | undefined | false;

const PROPERTY_KEYS = new Set([
  'value',
  'checked',
  'disabled',
  'hidden',
  'id',
  'type',
  'href',
  'src',
  'alt',
  'download',
  'accept',
  'min',
  'max',
  'step',
  'multiple',
  'selected',
  'htmlFor',
  'open',
  'draggable',
]);

/** Tiny hyperscript helper. Handlers use `onclick` style names; `class` sets className. Never sets inline styles (CSP). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function')
      node.addEventListener(key.slice(2), value as EventListener);
    else if (key === 'class') node.className = String(value);
    else if (PROPERTY_KEYS.has(key)) (node as unknown as Record<string, unknown>)[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'object' ? child : String(child));
  }
  return node;
}

/** Appends children, skipping null and false so conditional pieces can sit inline. */
export function put(parent: Element, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(typeof child === 'object' ? child : String(child));
  }
}

export function clear(node: Element): void {
  node.replaceChildren();
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private mode, site data cleared); preferences are optional.
  }
}
