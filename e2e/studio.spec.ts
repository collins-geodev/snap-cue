import { expect, test } from "@playwright/test";

test("landing leads to practice, feedback, and history", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Find your confidence");
  await page.getByRole("link", { name: "Start practicing" }).click();
  await expect(page.getByText("Demo mode")).toBeVisible();
  await page.getByRole("link", { name: "Quick start interview" }).click();
  await page.getByLabel("Target role").fill("GIS Engineer");
  await page.getByLabel("Question count").fill("1");
  await page.getByRole("button", { name: "Start interview" }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 1" })).toBeVisible();
  await page.getByRole("button", { name: "Insert sample transcript" }).click();
  await expect(page.getByLabel("Your answer")).toHaveValue(/clarified the goal/);
  await page.getByRole("button", { name: "Evaluate answer" }).click();
  await expect(page.getByRole("heading", { name: "Feedback" })).toBeVisible();
  await page.getByRole("button", { name: "Finish and save" }).click();
  await expect(page.getByRole("heading", { name: "Interview complete" })).toBeVisible();
  await page.getByRole("link", { name: "Interview history" }).click();
  await page.getByLabel("Search interviews").fill("GIS Engineer");
  await expect(page.locator("summary").getByText("GIS Engineer")).toBeVisible();
  await page.reload();
  await expect(page.locator("summary").getByText("GIS Engineer")).toBeVisible();
});

test("mobile navigation works and live mode requires both permissions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () => { throw new Error("Demo must never request the microphone"); }
    });
  });
  await page.goto("/studio");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Live assistant" }).click();
  const start = page.getByRole("button", { name: "Start session" });
  await expect(start).toBeDisabled();
  await page.getByLabel(/interview rules/i).check();
  await expect(start).toBeDisabled();
  await page.getByLabel(/everyone permits/i).check();
  await start.click();
  await page.getByRole("button", { name: "Simulate question" }).click();
  await expect(page.getByLabel("Detected question")).toHaveValue(/measure the impact/);
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start again" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("demo documents and job analysis work without cloud credentials", async ({ page }) => {
  await page.goto("/studio/profile");
  await page.getByLabel("Version name").fill("GIS CV");
  await page.getByLabel("Document file").setInputFiles({ name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from("GIS engineer with Python experience.") });
  await page.getByRole("button", { name: "Save CV" }).click();
  await expect(page.locator("summary").getByText("GIS CV")).toBeVisible();
  await page.getByRole("link", { name: "Job intelligence" }).click();
  await page.getByLabel("Position").fill("Geospatial Analyst");
  await page.getByLabel("Job description text").fill("GIS analysis and SQL communication.");
  await page.getByRole("button", { name: "Analyze and save" }).click();
  await page.locator("summary").getByText("Geospatial Analyst").click();
  await expect(page.getByRole("heading", { name: "skills", exact: true })).toBeVisible();
});

test("light is the default and the studio keeps an explicit theme choice", async ({ page }) => {
  await page.goto("/");
  const root = page.locator("html");
  await expect(root).toHaveCSS("color-scheme", "light");
  await page.getByRole("link", { name: "Start practicing" }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
});
