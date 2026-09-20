# FrameLab

FrameLab is a modern, browser-based frontend playground for experimenting with:

- HTML, CSS, and JavaScript
- React and JSX
- Angular and TypeScript

Each framework runs in its own isolated Sandpack runtime. The app includes live preview, console output, responsive device previews, starter templates, local autosave, shareable URLs, theme switching, and ZIP export.

The plain web workspace follows CodePen-style panel semantics: `index.html` may contain only body markup, while `styles.css` and `index.js` are injected automatically into a sandboxed preview. Full HTML documents are supported too. Paste compiled CSS into `styles.css`; raw SCSS syntax requires compilation first.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## How the playground works

1. Pick a runtime from the left rail.
2. Edit any file in the code workspace.
3. Press **Run** or `Ctrl/⌘ + Enter`.
4. Inspect the rendered result and browser console.

Your latest files are saved in browser storage. Use **Share** to copy the current playground into a URL, or **Download** to export its files as a ZIP.

## Architecture

- React + TypeScript application shell
- Vite development and production build
- CodeSandbox Sandpack for isolated in-browser bundling and preview
- CSS design system without an additional UI framework

The original proof of concept injected all frameworks into one iframe. FrameLab separates the runtimes, avoiding dependency collisions while keeping the product fully client-side.
