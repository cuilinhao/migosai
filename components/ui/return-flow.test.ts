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
