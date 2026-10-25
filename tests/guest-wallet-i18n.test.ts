import { describe, expect, it } from "vitest";
import { getMessages, translate } from "../lib/i18n";
import { guestWalletSources } from "../lib/i18n/messages/guest-wallet";

describe("guest wallet translations", () => {
  it.each(["zh-TW", "ko", "ja", "fr", "es"] as const)("provides wallet instructions and errors in %s", locale => {
    for (const source of guestWalletSources) {
      expect(getMessages(locale)[source], source).toBeTruthy();
      expect(translate(locale, source), source).not.toBe(source);
      expect((translate(locale, source).match(/\{\w+\}/g) ?? []).sort()).toEqual((source.match(/\{\w+\}/g) ?? []).sort());
    }
  });
  it("keeps English source text", () => {
    for (const source of guestWalletSources) expect(translate("en", source)).toBe(source);
  });
});
