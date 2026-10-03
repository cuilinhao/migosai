export type Messages = Record<string, string>;
export type Values = Record<string, string | number>;
export type Translator = (source: string, values?: Values) => string;
export function createTranslator(messages: Messages = {}): Translator {
  return (source, values) => {
    // Preserve boundary whitespace around inline React elements.
    const key = source.trim();
    const translated = messages[source] ?? (messages[key] ? source.replace(key, messages[key]) : source);
    return values ? translated.replace(/\{(\w+)\}/g, (match, name: string) => Object.hasOwn(values, name) ? String(values[name]) : match) : translated;
  };
}
