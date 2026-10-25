import { describe, expect, it, vi } from "vitest";
import LocalizedPage, { generateMetadata } from "@/app/[locale]/[[...path]]/page";
import { locales } from "@/lib/i18n/routing";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); }, permanentRedirect: () => { throw new Error("redirect"); } }));
vi.mock("@/lib/i18n/server", () => ({ getTranslations: async () => (source: string) => source, localizeMetadata: async (value: unknown) => value }));
vi.mock("@/app/app/layout", () => ({ default: ({ children }: { children: unknown }) => children }));

describe("guest wallet routes", () => {
  it.each(locales)("resolves the recovery page and excludes it from indexing in %s", async locale => {
    const props = { params: Promise.resolve({ locale, path: ["guest-wallet"] }) };
    await expect(LocalizedPage(props)).resolves.toBeTruthy();
    expect(await generateMetadata(props)).toMatchObject({ title: "Guest wallet", robots: { index: false, follow: false } });
  });
});
