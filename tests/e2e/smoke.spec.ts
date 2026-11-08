import { expect, test } from "@playwright/test";

/**
 * Smoke test: the page loads, the WebGL globe canvas mounts at a real size,
 * and the headline counter resolves to a number. It passes with live
 * CelesTrak data *or* the bundled sample (the app must never be blank).
 */
test("globe canvas and counter render", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");

  const canvas = page.getByTestId("globe-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(300);
  expect(box?.height ?? 0).toBeGreaterThan(300);

  // The counter starts as "——" and becomes e.g. "19,402" once the worker has the catalog.
  const counter = page.getByTestId("counter");
  await expect(counter).toContainText(/\d[\d,]*/);
  await expect(counter).toContainText("OBJECTS IN ORBIT");

  const count = Number((await counter.innerText()).match(/\d[\d,]*/)?.[0].replace(/,/g, ""));
  expect(count).toBeGreaterThan(100);

  expect(errors, `uncaught page errors: ${errors.join("; ")}`).toEqual([]);
});
