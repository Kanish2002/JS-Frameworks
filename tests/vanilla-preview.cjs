// Run with: NODE_PATH=<directory containing playwright> node tests/vanilla-preview.cjs
// Start the app first; BASE_URL defaults to http://localhost:5173.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const runtimeResources = [
      ['https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js', 'window.__runtimeOrder=(window.__runtimeOrder||[]).concat("jquery");window.jQuery=window.$=function(){};'],
      ['https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js', 'window.__runtimeOrder=(window.__runtimeOrder||[]).concat("lodash");window._={VERSION:"4.17.21"};'],
      ['https://cdnjs.cloudflare.com/ajax/libs/hammer.js/1.0.6/hammer.min.js', 'window.__runtimeOrder=(window.__runtimeOrder||[]).concat("hammer");window.Hammer=function(){};'],
    ];
    for (const [url, body] of runtimeResources) {
      await page.route(url, route => route.fulfill({contentType: 'text/javascript', body}));
    }
    await page.goto(process.env.BASE_URL || 'http://localhost:5173', {waitUntil: 'domcontentloaded'});
    const load = async files => {
      await page.evaluate(files => localStorage.setItem('framelab-workspaces-v2', JSON.stringify({vanilla: files})), files);
      await page.reload({waitUntil: 'domcontentloaded'});
      await page.locator('.cm-content').waitFor();
      await page.frameLocator('.plain-preview-iframe').locator('body').waitFor();
    };
    await load({
      '/index.html': '<!doctype html><html><head></head><body><button id="increment" onclick="increment()">Add</button><output id="count">0</output></body></html>',
      '/styles.css': 'output { color: rgb(1, 2, 3); }',
      '/index.js': 'const special = "$& $` $\' </script>"; document.body.dataset.runtimeOrder = [...window.__runtimeOrder, "user"].join(","); document.body.dataset.runtimeGlobals = [typeof jQuery, typeof _, typeof Hammer].join(","); console.log(special); let count = 0; function increment() { document.querySelector("#count").textContent = ++count; } document.addEventListener("DOMContentLoaded", () => console.log("DOM ready"));'
    });
    const preview = () => page.frameLocator('.plain-preview-iframe');
    assert.equal(await preview().locator('body').getAttribute('data-runtime-order'), 'jquery,lodash,hammer,user');
    assert.equal(await preview().locator('body').getAttribute('data-runtime-globals'), 'function,object,function');
    await preview().locator('#increment').click();
    assert.equal(await preview().locator('#count').textContent(), '1');
    assert.equal(await preview().locator('#count').evaluate(el => getComputedStyle(el).color), 'rgb(1, 2, 3)');
    await page.getByRole('log').getByText('DOM ready', {exact: false}).waitFor();
    assert.ok((await page.getByRole('log').textContent()).includes('$& $` $\' </script>'));
    await page.locator('.run-button').click();
    await page.waitForFunction(() => document.querySelector('.plain-preview-iframe'));
    await preview().locator('#count').filter({hasText: /^0$/}).waitFor();
    console.log('PASS: JavaScript literals, CSS, global handlers, DOM ready and repeated Run');
    for (const file of ['styles.css', 'index.js']) {
      await page.locator('.sp-tab-button').filter({hasText: file}).click();
      const editor = page.locator(`.cm-content[aria-label="Code Editor for ${file}"]`);
      await editor.click();
      await page.keyboard.press('Control+End');
      await page.keyboard.insertText('\n/* edit-check */');
      await page.waitForTimeout(1100);
      assert.ok((await editor.textContent()).includes('edit-check'));
      assert.equal(await editor.getAttribute('contenteditable'), 'true');
      assert.ok(await editor.evaluate(el => el === document.activeElement));
      await page.keyboard.press('Control+z');
      assert.ok(!(await editor.textContent()).includes('edit-check'));
    }
    console.log('PASS: CSS/JS tab editing, focus after preview/autosave, and undo');
    const jqueryUrl = 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js';
    await load({
      '/index.html': `<html><body><script async src="${jqueryUrl}"></script><script src="${jqueryUrl}"></script><output id="libraries"></output></body></html>`,
      '/styles.css': '',
      '/index.js': 'document.querySelector("#libraries").textContent = [typeof jQuery, typeof _, typeof Hammer].join(",");'
    });
    await preview().locator('#libraries').filter({hasText: /^function,object,function$/}).waitFor();
    assert.equal(await preview().locator(`script[src="${jqueryUrl}"]`).count(), 1);
    assert.equal(await preview().locator(`script[src="${jqueryUrl}"]`).getAttribute('async'), null);
    console.log('PASS: default runtime libraries load once in deterministic order');
    await load({
      '/index.html': '<html><head><link rel="stylesheet" href="./styles.css"><script defer src="./helper.js"></script><script defer src="./index.js"></script></head><body><output id="result"></output></body></html>',
      '/styles.css': 'output { color: rgb(4, 5, 6); }',
      '/helper.js': 'window.helper = 40;',
      '/index.js': 'window.calls = (window.calls || 0) + 1; document.querySelector("#result").textContent = helper + calls;'
    });
    await preview().locator('#result').filter({hasText: /^41$/}).waitFor();
    assert.equal(await preview().locator('#result').evaluate(el => getComputedStyle(el).color), 'rgb(4, 5, 6)');
    console.log('PASS: relative local references, deferred dependency order, no duplicate execution');
    await load({'/index.html': '<script>throw new Error("inline-test-error")</script><p>Still rendered</p>', '/index.js': 'console.log("after-error")'});
    await page.getByRole('log').getByText('inline-test-error', {exact: false}).waitFor();
    await page.getByRole('log').getByText('after-error', {exact: false}).waitFor();
    console.log('PASS: early inline errors reported and later scripts execute');
    await load({
      '/index.html': '<button id="move">Move</button><output id="score">0</output>',
      '/styles.css': Array.from({length: 400}, (_, i) => `.tile-${i} { color: red; }`).join('\n'),
      '/index.js': `let score = Number(localStorage.getItem('framelab-test-score') || 0);
        localStorage.setItem('framelab-escape', '</script>');
        document.querySelector('#score').textContent = score;
        function move() { localStorage.setItem('framelab-test-score', String(++score)); document.querySelector('#score').textContent = score; }
        document.querySelector('#move').addEventListener('click', move);
        document.addEventListener('keydown', event => { if (event.key === 'ArrowLeft') move(); });` + Array.from({length: 400}, (_, i) => `\n// game line ${i}`).join(''),
    });
    await preview().locator('#move').click();
    await preview().locator('#score').filter({hasText: /^1$/}).waitFor();
    await page.locator('.run-button').click();
    await preview().locator('#score').filter({hasText: /^1$/}).waitFor();
    await preview().locator('#move').click();
    await page.keyboard.press('ArrowLeft');
    await preview().locator('#score').filter({hasText: /^3$/}).waitFor();
    assert.ok(!(await page.locator('.plain-preview-iframe').getAttribute('sandbox')).includes('allow-same-origin'));
    await page.reload({waitUntil: 'domcontentloaded'});
    await preview().locator('#score').filter({hasText: /^3$/}).waitFor();
    console.log('PASS: game input and saved score survive a preview rerun in an isolated iframe');
    for (const file of ['styles.css', 'index.js']) {
      await page.locator('.sp-tab-button').filter({hasText: file}).click();
      const scroller = page.locator('.cm-scroller');
      assert.ok(await scroller.evaluate(el => el.scrollHeight > el.clientHeight + 300));
      await scroller.evaluate(el => { el.scrollTop = 500; });
      assert.ok(await scroller.evaluate(el => el.scrollTop >= 450));
    }
    console.log('PASS: long CSS and JS files scroll inside the editor');
    await page.setViewportSize({width: 390, height: 844});
    await page.locator('.preview-panel').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('.plain-preview-iframe').isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    console.log('PASS: mobile editor and preview remain reachable without horizontal overflow');
    assert.deepEqual(errors.filter(e => !e.includes('inline-test-error')), []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
