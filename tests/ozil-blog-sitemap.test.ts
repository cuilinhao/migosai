import { describe, expect, it } from "vitest";
import sitemap from "../app/sitemap";

describe("Ozil blog discovery", () => {
  it("indexes the blog and native articles without inventing translated copies", () => {
    const entries = sitemap();
    const paths = [
      "/ozil-goal-generator/blog",
      "/ozil-goal-generator/blog/what-is-ozil-goal-trend",
      "/ozil-goal-generator/blog/como-colocar-minha-foto-no-gol-do-ozil",
      "/ozil-goal-generator/blog/gol-de-ozil-con-mi-foto",
    ];
    for (const path of paths) {
      const matches = entries.filter(entry => new URL(entry.url).pathname.endsWith(path));
      expect(matches.map(entry => entry.url)).toEqual([`https://migosai.design${path}`]);
    }
    const portuguese = entries.find(entry => entry.url.endsWith("/como-colocar-minha-foto-no-gol-do-ozil"));
    expect(portuguese?.alternates?.languages?.["pt-BR"]).toBe("https://migosai.design/ozil-goal-generator/blog/como-colocar-minha-foto-no-gol-do-ozil");
    expect(portuguese?.alternates?.languages?.es).toBe("https://migosai.design/ozil-goal-generator/blog/gol-de-ozil-con-mi-foto");
  });
});
