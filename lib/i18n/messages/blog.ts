import ko from "./blog-ko.json";
import ja from "./blog-ja.json";
import fr from "./blog-fr.json";
import es from "./blog-es.json";
import zhTW from "./blog-zh-TW.json";
import type { TranslatedLocale } from "../routing";

// Server-only blog copy. Kept out of getMessages() so article text is not sent to every page's client bundle.
export const blogMessages: Record<TranslatedLocale, Record<string, string>> = { ko, ja, fr, es, "zh-TW": zhTW };
