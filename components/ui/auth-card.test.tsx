import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthCard } from "../auth-provider";

describe("account form", () => {
  it("offers email login with password-manager autocomplete", () => {
    const html = renderToStaticMarkup(<AuthCard authConfigured />);
    expect(html).toContain('type="email"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('type="submit"');
  });
  it("offers registration with a new password and an accessible password toggle", () => {
    const html = renderToStaticMarkup(<AuthCard kind="sign-up" authConfigured />);
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('minLength="8"');
    expect(html).toContain('aria-label="Show password"');
    expect(html).toContain('href="/privacy-policy"');
  });
});
