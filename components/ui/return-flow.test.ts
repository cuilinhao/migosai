import { describe, expect, it } from "vitest";
import { authReturnTo, safeAuthReturnTo } from "./auth-return";
import { confirmedCheckout } from "./checkout-confirmation";

describe("authentication return route", () => {
  it("returns a signed-in user from standalone auth to the intended account page", () => {
    expect(authReturnTo({ pathname: "/sign-in", search: "?returnTo=%2Fapp%2Fmy-videos" })).toBe("/app/my-videos");
    expect(authReturnTo({ pathname: "/sign-up", search: "" })).toBe("/app/video-generator");
  });
  it("keeps modal sign-in on its original page", () => {
    expect(authReturnTo({ pathname: "/pricing", search: "?checkout=completed" })).toBe("/pricing?checkout=completed");
  });
  it("preserves the language for standalone authentication and modal return routes", () => {
    expect(authReturnTo({ pathname: "/ko/sign-up", search: "" })).toBe("/ko/app/video-generator");
    expect(authReturnTo({ pathname: "/ja/sign-in", search: "?returnTo=%2Fapp%2Fmy-videos%3Fpage%3D2" })).toBe("/ja/app/my-videos?page=2");
    expect(authReturnTo({ pathname: "/fr/sign-in", search: "?returnTo=%2Ffr%2Fpricing" })).toBe("/fr/pricing");
    expect(authReturnTo({ pathname: "/es/pricing", search: "?checkout=completed" })).toBe("/es/pricing?checkout=completed");
    expect(authReturnTo({ pathname: "/zh-TW/sign-in", search: "?returnTo=%2Fja%2Fapp%2Fmy-videos" })).toBe("/zh-TW/app/my-videos");
  });
  it("rejects localized auth loops without losing the current language", () => {
    expect(safeAuthReturnTo("/ko/sign-in", "ko")).toBe("/ko/app/video-generator");
    expect(safeAuthReturnTo("/fr/sign-up?returnTo=%2Ffr%2Fsign-in", "fr")).toBe("/fr/app/video-generator");
    expect(safeAuthReturnTo("//evil.example", "es")).toBe("/es/app/video-generator");
    expect(safeAuthReturnTo("/zh-TW/sign-in", "zh-TW")).toBe("/zh-TW/app/video-generator");
  });
  it("uses the selected sign-in language after switching languages with a saved return route", () => {
    expect(authReturnTo({ pathname: "/fr/sign-in", search: "?returnTo=%2Fja%2Fapp%2Fmy-videos" })).toBe("/fr/app/my-videos");
    expect(authReturnTo({ pathname: "/sign-in", search: "?returnTo=%2Fes%2Fpricing" })).toBe("/pricing");
    expect(safeAuthReturnTo("/ko/pricing")).toBe("/ko/pricing");
  });
  it("rejects external and recursive destinations", () => {
    for (const value of ["https://evil.example", "//evil.example", "/%2Fevil.example", "/sign-in", "/sign-up?x=1", "/%5Cevil.example"]) {
      expect(safeAuthReturnTo(value)).toBe("/app/video-generator");
    }
  });
});

describe("checkout confirmation", () => {
  const orders = [
    { id: "previous", status: "paid", credits: 300 },
    { id: "current", status: "pending", credits: 1200 },
  ];
  it("does not treat a return URL or another paid order as confirmation", () => {
    expect(confirmedCheckout(orders, "current")).toBeNull();
  });
  it("confirms only the matching server-paid order", () => {
    expect(confirmedCheckout([...orders, { id: "current", status: "paid", credits: 1200 }], "current"))
      .toMatchObject({ id: "current", credits: 1200, status: "paid" });
  });
});
