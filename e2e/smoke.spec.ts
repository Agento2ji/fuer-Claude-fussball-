import { expect, test } from "@playwright/test";

test("Startseite führt über Tabelle und Team zur Spielerseite", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fußball-Hub", level: 1 })).toBeVisible();

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
