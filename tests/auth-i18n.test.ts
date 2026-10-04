import { describe, expect, it } from "vitest";
import { getMessages, translate } from "../lib/i18n";

const translatedLocales = ["ko", "ja", "fr", "es", "zh-TW"] as const;
const authSources = [
  "Welcome back",
  "Create your account",
  "Your next great video starts here.",
  "Two photos. Endless possibilities.",
  "Continue with Google",
  "or continue with email",
  "Email address",
  "Password",
  "Show password",
  "Hide password",
  "At least 8 characters",
  "Sign in",
  "Create account",
  "Signing in…",
  "Creating account…",
  "New to LobbyDuo?",
  "Already have an account?",
  "By continuing, you agree to our",
  "Terms of Service",
  "and",
  "Privacy Policy",
  "Email sign-in is temporarily unavailable.",
  "We could not connect. Please try again.",
  "Something went wrong. Please try again.",
  "Back to home",
  "Enter a valid email address.",
  "Use a password with 8 to 128 characters.",
  "Use a name with at most 80 characters.",
  "An account already uses this email. Sign in with your existing method.",
  "Email or password is incorrect.",
  "Too many sign-in attempts. Please try again in 15 minutes.",
  "Google sign-in could not be verified. Please try again.",
  "Google sign-in is temporarily unavailable. Please try again.",
  "Google sign-in is temporarily unavailable.",
  "Google sign-in is not configured yet.",
  "Sign-in expired or was cancelled. Please try again.",
  "Sign-in has expired. Please try again.",
  "Send a JSON request.",
  "Invalid JSON.",
  "Request is too large.",
  "Cross-site request rejected.",
  "Start sign-in from this website.",
  "Please sign in to continue.",
  "Could not establish a session.",
  "The service is temporarily unavailable. Please try again later.",
] as const;

describe("authentication translations", () => {
  it.each(translatedLocales)("localizes every account form and error message in %s", (locale) => {
    const messages = getMessages(locale);
    for (const source of authSources) {
      expect(messages[source], `${locale}: ${source}`).toBeDefined();
      expect(translate(locale, source).trim(), `${locale}: ${source}`).not.toBe("");
      expect(translate(locale, source), `${locale}: ${source}`).not.toBe(source);
    }
  });

  it.each(translatedLocales)("preserves placeholders and inline spacing in %s", (locale) => {
    for (const source of authSources) {
      const translation = translate(locale, source);
      expect((translation.match(/\{\w+\}/g) ?? []).sort()).toEqual((source.match(/\{\w+\}/g) ?? []).sort());
      expect(translate(locale, ` ${source} `)).toBe(` ${translation} `);
    }
  });

  it("uses English source messages in the default locale", () => {
    for (const source of authSources) expect(translate("en", source)).toBe(source);
  });
});
