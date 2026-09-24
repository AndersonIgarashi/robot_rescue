type Attrs = Record<string, string | number | boolean | undefined>;

/** Tiny element factory — keeps UI construction declarative without a framework. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  attrs: Attrs = {},
  children: ReadonlyArray<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) node.append(child);
  return node;
}

/** Parses a trusted, static SVG/HTML snippet (icons defined in source) into a node. */
export function fromMarkup(markup: string): Element {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  const node = template.content.firstElementChild;
  if (!node) throw new Error('fromMarkup: empty markup');
  return node;
}

/** Restarts a CSS animation on an element by toggling a class across a reflow. */
export function replayClass(node: Element, className: string): void {
  node.classList.remove(className);
  void (node as HTMLElement).offsetWidth;
  node.classList.add(className);
}

export const toCssHex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
