import { expect, test } from "@playwright/test";

test("Ligen führen über Tabelle und Team zur Spielerseite", async ({ page }) => {
  await page.goto("/wettbewerbe");
  await expect(page.getByRole("heading", { name: "Ligen und Spiele", level: 1 })).toBeVisible();

  await page.locator("main a[href='/wettbewerbe/TEST']").click();
  await expect(page.getByRole("heading", { name: /Testliga/, level: 1 })).toBeVisible();
  const rows = page.getByRole("table").getByRole("row");
  await expect(rows).toHaveCount(7); // Kopfzeile + 6 Vereine

  await page.getByRole("link", { name: "FC Nordstadt" }).first().click();
  await expect(page.getByRole("heading", { name: "FC Nordstadt", level: 1 })).toBeVisible();
  await expect(page.getByText("Testdaten.", { exact: false }).first()).toBeVisible();

  await page.getByRole("link", { name: "Milan Naumann" }).first().click();
  await expect(page.getByRole("heading", { name: "Milan Naumann", level: 1 })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Verletzt");
});

test("Jede Zahl zeigt beim Antippen Quelle und Stand", async ({ page }) => {
  await page.goto("/spieler");
  await page.getByRole("link", { name: /Felix Lindner/ }).click();
  await expect(page.getByText("Sperrgefährdet").first()).toBeVisible();
  await page.getByRole("button", { name: /Gelbe Karten.*Quelle anzeigen/ }).first().click();
  const popover = page.getByRole("dialog");
  await expect(popover).toContainText("Quelle");
  await expect(popover).toContainText("Testdaten (erfunden)");
  await expect(popover).toContainText("Stand");
});

test("Unbekannte Seiten zeigen eine deutsche Fehlermeldung", async ({ page }) => {
  await page.goto("/spieler/999999");
  await expect(page.getByRole("heading", { name: "Nicht gefunden" })).toBeVisible();
});

test("Hell/Dunkel lässt sich umschalten und bleibt erhalten", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Hellen Modus einschalten" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("Formbewertung zeigt Stufe, Perzentil und Erklärung", async ({ page }) => {
  await page.goto("/spieler");
  await page.getByRole("link", { name: /Jakob Kuhn/ }).click();
  const card = page.locator("[data-slot=card]", { hasText: "Formbewertung" });
  await expect(card).toContainText("Bestform der Karriere");
  await expect(card).toContainText("Perzentil der Karriere");
  await card.getByRole("button", { name: /Wie entsteht das/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Standardabweichungen");
});

test("Spielseite zeigt Countdown, Sender, Aufstellungen und direkten Vergleich", async ({ page }) => {
  await page.goto("/wettbewerbe/TEST");
  await page.locator("main a[href^='/spiele/']").first().click();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByText("Übertragung in Deutschland")).toBeVisible();
  await expect(page.getByText("Voraussichtliche Aufstellung").first()).toBeVisible();
  await expect(page.getByText("Direkter Vergleich")).toBeVisible();
  await expect(page.getByText(/erfasste Duelle?/)).toBeVisible();
});

test("Quoten erst nach Altersbestätigung, mit Hilfehinweis und ohne Pinnacle", async ({ page }) => {
  await page.goto("/quoten");
  await expect(page.getByRole("heading", { name: "Quoten nur ab 18 Jahren" })).toBeVisible();
  await expect(page.locator("main a[href$='/quoten']")).toHaveCount(0);

  await page.getByLabel("Ich bin mindestens 18 Jahre alt.").check();
  await page.getByRole("button", { name: "Weiter zu den Quoten" }).click();
  await page.locator("main a[href$='/quoten']").first().click();

  await expect(page.getByText("Value-Tipps", { exact: true })).toBeVisible();
  await expect(page.getByText("0800 1 37 27 00")).toBeVisible();
  await expect(page.getByText(/Modellrechnung/).first()).toBeVisible();
  await expect(page.getByRole("table").first()).toContainText("Tipico");
  await expect(page.getByRole("table").first()).toContainText("Winamax");
  await expect(page.locator("main")).not.toContainText("Pinnacle");
});

test("Startseite zeigt Value-Tipps über alle Spiele, filterbar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Value-Tipps", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quoten nur ab 18 Jahren" })).toBeVisible();
  await page.getByLabel("Ich bin mindestens 18 Jahre alt.").check();
  await page.getByRole("button", { name: "Weiter zu den Quoten" }).click();

  const cards = page.locator("main ol > li");
  await expect(cards.first()).toBeVisible();
  await expect(cards.first()).toContainText("EV");
  await expect(page.getByText("0800 1 37 27 00")).toBeVisible();

  await page.getByRole("navigation", { name: "Filter" }).getByRole("link", { name: "1X2" }).click();
  await expect(page).toHaveURL(/markt=h2h/);
  await expect(cards.first()).toBeVisible();
  for (const text of await cards.allTextContents()) expect(text).toContain("Ergebnis (1X2)");

  await cards.first().getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Quotenvergleich", level: 1 })).toBeVisible();
});

test("Suche per Tastatur: / öffnet, Pfeiltasten wählen, Enter öffnet", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("/");
  const input = page.getByPlaceholder("Spieler, Team oder Spiel …");
  await expect(input).toBeFocused();
  await input.fill("nordstadt");
  await expect(page.getByRole("option", { name: /FC Nordstadt/ }).first()).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/(teams|spieler|spiele)\/\d+/);

  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Spieler, Team oder Spiel …").fill("munchen");
  await page.keyboard.press("Escape");
  await expect(page.getByPlaceholder("Spieler, Team oder Spiel …")).toBeHidden();
});
