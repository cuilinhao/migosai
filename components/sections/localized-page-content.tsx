import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

type Translate = (source: string, values?: Record<string, string | number>) => string;
const contentProps = new Set(["children", "title", "subtitle", "intro", "label", "description", "caption", "headings", "rows", "sections", "steps", "features", "items", "body", "question", "answer", "alt", "aria-label"]);
const contentFields = new Set(["title", "subtitle", "description", "label", "body", "question", "answer"]);

/** Translate page-owned copy while retaining elements, links, identifiers and client boundaries. */
export function localizePageContent(node: ReactNode, t: Translate): ReactNode {
  if (typeof node === "string") {
    const text = node.trim();
    if (!text) return node;
    let translated = t(text);
    if (translated === text) {
      const credits = text.match(/^(\d+) credits$/);
      const seconds = text.match(/^(\d+) seconds$/);
      const config = text.match(/^([\d:]+) · (\d+) seconds · (\d+p)$/);
      const example = text.match(/^Hotel Lobby reference example (\d+)$/);
      if (credits) translated = t("{count} credits", { count: credits[1] });
      else if (seconds) translated = t("{count} seconds", { count: seconds[1] });
      else if (config) translated = t("{aspect} · {duration} seconds · {resolution}", { aspect: config[1], duration: config[2], resolution: config[3] });
      else if (example) translated = t("Hotel Lobby reference example {number}", { number: example[1] });
    }
    return `${node.match(/^\s*/)?.[0] ?? ""}${translated}${node.match(/\s*$/)?.[0] ?? ""}`;
  }
  if (Array.isArray(node)) return node.map((child, index) => withListKey(localizePageContent(child, t), index));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(element.props)) {
    if (contentProps.has(key)) props[key] = localizeValue(value, t);
  }
  if (typeof element.type === "string" && textBlocks.has(element.type)) {
    const rich = localizeRichText(element.props.children as ReactNode, t);
    if (rich !== undefined) props.children = rich;
  }
  return cloneElement(element, props);
}

function withListKey<T>(value: T, index: number): T {
  return (isValidElement(value) && value.key == null ? cloneElement(value, { key: `localized-${index}` }) : value) as T;
}

function localizeValue(value: unknown, t: Translate): unknown {
  if (Array.isArray(value)) return value.map((item, index) => withListKey(localizeValue(item, t), index));
  if (value && typeof value === "object" && !isValidElement(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, contentFields.has(key) ? localizeValue(item, t) : item]));
  }
  return localizePageContent(value as ReactNode, t);
}

const textBlocks = new Set(["p", "li", "h1", "h2", "h3", "figcaption"]);
const inlineTags = new Set(["a", "b", "strong", "span", "br", "time"]);

/** Keep links and emphasis in their translated sentence rather than translating disconnected fragments. */
function localizeRichText(children: ReactNode, t: Translate): ReactNode | undefined {
  const elements: ReactElement<Record<string, unknown>>[] = [];
  function serialize(child: ReactNode): string {
    if (child == null || typeof child === "boolean") return "";
    if (typeof child === "string" || typeof child === "number") return String(child);
    if (Array.isArray(child)) return child.map(serialize).join("");
    if (!isValidElement(child)) throw new Error("Not inline content");
    const element = child as ReactElement<Record<string, unknown>>;
    if (!(typeof element.type === "string" && inlineTags.has(element.type)) && typeof element.props.href !== "string") throw new Error("Not inline content");
    const index = elements.push(element) - 1;
    return `<${index}>${serialize(element.props.children as ReactNode)}</${index}>`;
  }
  let source: string;
  try { source = serialize(children).replace(/\s+/g, " ").trim(); } catch { return undefined; }
  if (!elements.length && !(Array.isArray(children) && children.some((child) => typeof child === "number"))) return undefined;
  const translated = t(source);
  if (translated === source) return undefined;
  const stack: { index: number; children: ReactNode[] }[] = [{ index: -1, children: [] }];
  const tags = /<(\/?)(\d+)>/g;
  let offset = 0;
  for (const match of translated.matchAll(tags)) {
    stack[stack.length - 1].children.push(translated.slice(offset, match.index));
    const index = Number(match[2]);
    if (!elements[index]) return undefined;
    if (match[1]) {
      const current = stack.pop();
      if (!current || current.index !== index || !stack.length) return undefined;
      stack[stack.length - 1].children.push(elements[index].type === "br"
        ? cloneElement(elements[index], { key: `localized-${index}` })
        : cloneElement(elements[index], { key: `localized-${index}` }, ...current.children));
    } else stack.push({ index, children: [] });
    offset = match.index! + match[0].length;
  }
  if (stack.length !== 1) return undefined;
  stack[0].children.push(translated.slice(offset));
  return stack[0].children;
}
