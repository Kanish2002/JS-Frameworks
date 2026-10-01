import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const runtimeResources = [
  ["https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js", "window.__runtimeOrder=(window.__runtimeOrder||[]).concat('jquery');window.jQuery=window.$=function(){};"],
  ["https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js", "window.__runtimeOrder=(window.__runtimeOrder||[]).concat('lodash');window._={VERSION:'4.17.21'};"],
  ["https://cdnjs.cloudflare.com/ajax/libs/hammer.js/1.0.6/hammer.min.js", "window.__runtimeOrder=(window.__runtimeOrder||[]).concat('hammer');window.Hammer=function(){};"],
] as const;

async function openWorkspace(page: Page, files?: Record<string, string>) {
  for (const [url, body] of runtimeResources) {
    await page.route(url, (route) => route.fulfill({ contentType: "text/javascript", body }));
  }
  await page.goto("/");
  if (files) {
    await page.evaluate((workspaceFiles) => {
      localStorage.setItem("framelab-workspaces-v2", JSON.stringify({ vanilla: workspaceFiles }));
    }, files);
    await page.reload();
  }
  await page.locator(".cm-content").first().waitFor();
  await page.frameLocator(".plain-preview-iframe").locator("body").waitFor();
}

test("plain HTML, CSS and JavaScript remain editable and execute in order", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await openWorkspace(page, {
    "/index.html": "<button id='increment'>Add</button><output id='count'>0</output>",
    "/styles.css": "output { color: rgb(1, 2, 3); }\n" + Array.from({ length: 350 }, (_, index) => `.tile-${index} { color: red; }`).join("\n"),
    "/index.js": "document.body.dataset.runtimeOrder=[...window.__runtimeOrder,'user'].join(',');let count=Number(localStorage.getItem('count')||0);const output=document.querySelector('#count');output.textContent=count;document.querySelector('#increment').addEventListener('click',()=>{output.textContent=String(++count);localStorage.setItem('count',String(count));});console.log('runtime-ready');\n" + Array.from({ length: 350 }, (_, index) => `// game line ${index}`).join("\n"),
  });

  const preview = page.frameLocator(".plain-preview-iframe");
  await expect(preview.locator("body")).toHaveAttribute("data-runtime-order", "jquery,lodash,hammer,user");
  await expect(preview.locator("#count")).toHaveCSS("color", "rgb(1, 2, 3)");
  await expect(page.getByRole("log")).toContainText("runtime-ready");

  await preview.locator("#increment").click();
  await expect(preview.locator("#count")).toHaveText("1");
  await page.getByRole("button", { name: /Run project/ }).click();
  await expect(preview.locator("#count")).toHaveText("1");

  await page.locator(".sp-tab-button").filter({ hasText: "index.js" }).click();
  const editor = page.locator('.cm-content[aria-label="Code Editor for index.js"]');
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.insertText("\n// edit-check");
  await expect(page.locator(".autosave-status")).toHaveText("Saving…");
  await expect(page.locator(".autosave-status")).toHaveText("Saved locally");
  await expect(editor).toContainText("edit-check");
  await expect(editor).toHaveAttribute("contenteditable", "true");

  await page.getByRole("button", { name: "New file" }).click();
  await page.getByLabel("File path").fill("/scripts/helpers.js");
  await page.getByRole("button", { name: "Add file", exact: true }).click();
  await expect(page.locator(".sp-tab-button").filter({ hasText: "helpers.js" })).toBeVisible();
  await expect(page.locator('.cm-content[aria-label="Code Editor for helpers.js"]')).toHaveAttribute("contenteditable", "true");

  await page.locator(".sp-tab-button").filter({ hasText: "index.js" }).click();
  const scroller = page.locator(".cm-scroller");
  expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight + 300)).toBe(true);
  await scroller.evaluate((element) => { element.scrollTop = 500; });
  expect(await scroller.evaluate((element) => element.scrollTop)).toBeGreaterThanOrEqual(450);
  expect(pageErrors).toEqual([]);
});

test("workspace controls stay reachable and panels resize across screen sizes", async ({ page }) => {
  await openWorkspace(page);

  const editorPreviewSeparator = page.getByRole("separator", { name: "Resize editor and preview" });
  await expect(editorPreviewSeparator).toBeVisible();
  await expect.poll(() => page.locator(".sp-tabs-scrollable-container").evaluate((element) => getComputedStyle(element).scrollbarWidth)).toBe("thin");
  const deviceSwitcher = page.getByRole("group", { name: "Preview size" });
  const deviceButtons = await deviceSwitcher.getByRole("button").all();
  const deviceButtonBoxes = await Promise.all(deviceButtons.map((button) => button.boundingBox()));
  const deviceButtonTopPositions = deviceButtonBoxes.map((box) => box!.y);
  expect(Math.max(...deviceButtonTopPositions) - Math.min(...deviceButtonTopPositions)).toBeLessThan(2);

  const previewCanvas = page.locator(".preview-canvas");
  const previewDevice = page.locator(".preview-device");
  for (const button of deviceButtons) {
    await button.click();
    const [canvasBox, deviceBox] = await Promise.all([previewCanvas.boundingBox(), previewDevice.boundingBox()]);
    const centeredLeft = canvasBox!.x + (canvasBox!.width - deviceBox!.width) / 2;
    expect(Math.abs(deviceBox!.x - centeredLeft)).toBeLessThan(2);
  }

  const editorBefore = await page.locator(".editor-panel").boundingBox();
  await editorPreviewSeparator.press("ArrowRight");
  const editorAfter = await page.locator(".editor-panel").boundingBox();
  expect(editorAfter!.width).toBeGreaterThan(editorBefore!.width);

  const console = page.locator(".console-panel");
  await page.getByRole("button", { name: /Console/ }).click();
  await expect(console).toHaveAttribute("data-open", "false");
  expect((await console.boundingBox())!.height).toBeLessThanOrEqual(40);
  await page.getByRole("button", { name: /Console/ }).click();
  await expect(console).toHaveAttribute("data-open", "true");
  expect((await console.boundingBox())!.height).toBeGreaterThan(100);

  await page.setViewportSize({ width: 900, height: 800 });
  const filesButton = page.getByRole("button", { name: "Files", exact: true });
  await expect(filesButton).toBeVisible();
  await filesButton.click();
  const drawer = page.getByRole("complementary", { name: "Project files" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("index.html");
  await page.getByRole("button", { name: "Close file drawer" }).last().click();
  await expect(drawer).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  const actionsButton = page.getByRole("button", { name: "Open project actions" });
  await expect(actionsButton).toBeVisible();
  await actionsButton.click();
  await expect(page.getByText("Starter template", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download project" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy share link" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Run project/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});
