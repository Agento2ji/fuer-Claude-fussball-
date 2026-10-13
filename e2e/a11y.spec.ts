import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Barrierefreiheit (WCAG 2.1 AA) über alle Seitentypen, hell und dunkel.
 * Keine Verstöße der Stufen „serious“ oder „critical“ erlaubt.
 */
const PAGES = ["/", "/spieler", "/quoten"];

async function dynamicPages(page: import("@playwright/test").Page) {
  await page.goto("/wettbewerbe/TEST");
  const team = await page.locator("main table a[href^='/teams/']").first().getAttribute("href");
  const match = await page.locator("main a[href^='/spiele/']").first().getAttribute("href");
  await page.goto(team!);
  const player = await page.locator("main a[href^='/spieler/']").first().getAttribute("href");
  return ["/wettbewerbe/TEST", team!, player!, match!, `${match}/quoten`];
}

for (const theme of ["dark", "light"] as const) {
  test(`keine schweren Barrierefreiheitsfehler (${theme})`, async ({ page, context }) => {
    await context.addCookies([{ name: "alter_18_bestaetigt", value: "1", url: "http://localhost:3100" }]);
    if (theme === "light") {
      await page.addInitScript(() => localStorage.setItem("theme", "light"));
    }
    const urls = [...PAGES, ...(await dynamicPages(page))];
    const problems: string[] = [];
    for (const url of urls) {
      await page.goto(url, { waitUntil: "networkidle" });
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of result.violations.filter((v) => v.impact === "serious" || v.impact === "critical")) {
        problems.push(`${url}: ${v.id} (${v.impact}) – ${v.nodes.length}× – ${v.nodes[0]?.target.join(" ")}`);
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
