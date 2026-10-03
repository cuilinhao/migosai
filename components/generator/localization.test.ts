import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { interactiveMessages } from "@/lib/i18n/messages/interactive";
import { createTranslator } from "@/lib/i18n/translator";
import { translateGenerationMessage } from "./use-generation";
import { VideoPreview } from "./video-preview";

const languages = ["ko", "ja", "fr", "es", "zh-TW"] as const;

describe.each(languages)("%s generation localization", (locale) => {
  const messages = interactiveMessages[locale];
  const t = createTranslator(messages);

  it("translates preview and server moderation status without changing media URLs", () => {
    const message = "Checking video safety before delivery…";
    const pending = renderToStaticMarkup(createElement(LocaleProvider, { locale, messages,
      children: createElement(VideoPreview, { generation: { id: "job", status: "reviewing", progress: 95, statusMessage: message }, stage: "", error: "" }),
    }));
    expect(pending).toContain(messages[message]);
    expect(pending).not.toContain(message);
    expect(pending).toContain(messages["Video Preview"]);
    expect(pending).not.toContain("<video");

    const ready = renderToStaticMarkup(createElement(LocaleProvider, { locale, messages,
      children: createElement(VideoPreview, { generation: { id: "job", status: "completed", progress: 100, videoUrl: "/api/media/saved-video" }, stage: "", error: "" }),
    }));
    expect(ready).toContain('src="/api/media/saved-video"');
    expect(ready).toContain(messages["Your generated video is ready to watch and download."]);
  });

  it("localizes dynamic HTTP and credit errors while retaining their values", () => {
    expect(translateGenerationMessage(t, "Request failed (503)."))
      .toBe(t("Request failed ({status}).", { status: 503 }));
    expect(translateGenerationMessage(t, "Photo upload failed (HTTP 413)."))
      .toBe(t("Photo upload failed (HTTP {status}).", { status: 413 }));
    expect(translateGenerationMessage(t, "You need 150 credits to create this video."))
      .toBe(t("You need {credits} credits to create this video.", { credits: 150 }));
    expect(translateGenerationMessage(t, "lyrics must be text of 5000 characters or fewer."))
      .toBe(t("{field} must be text of {max} characters or fewer.", { field: t("Lyrics"), max: 5000 }));
  });

  it("handles composed provider errors and preserves unknown diagnoses", () => {
    const message = "The video provider request was not accepted.";
    expect(translateGenerationMessage(t, `${message} Your credits have been returned.`))
      .toBe(`${t(message)} ${t("Your credits have been returned.")}`);
    expect(translateGenerationMessage(t, "Unrecognized provider diagnostic #123"))
      .toBe("Unrecognized provider diagnostic #123");
  });
});
