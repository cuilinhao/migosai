import ko from "./pages-ko.json";
import ja from "./pages-ja.json";
import fr from "./pages-fr.json";
import es from "./pages-es.json";
import zhTW from "./pages-zh-TW.json";
import type { TranslatedLocale } from "../routing";

export const pageMessages: Record<TranslatedLocale, Record<string, string>> = { ko, ja, fr, es, "zh-TW": zhTW };
