import {
  SandpackCodeEditor,
  SandpackConsole,
  SandpackFileExplorer,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { ChevronDown, ChevronUp, Files, Laptop, Monitor, Smartphone, TerminalSquare, X } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { SandpackFiles } from "@codesandbox/sandpack-react";
import type { Layout } from "react-resizable-panels";
import type { DeviceId, PlaygroundMode, ThemeId } from "../types";

export interface WorkspaceActions {
  run: () => void;
}

interface WorkspaceProps {
  mode: PlaygroundMode;
  files: SandpackFiles;
  theme: ThemeId;
  onFilesChange: (files: SandpackFiles) => void;
}

interface ActionBridgeProps {
  onFilesChange: (files: SandpackFiles) => void;
  onRunStateChange: (state: RunState) => void;
  onSaveStateChange: (state: SaveState) => void;
  registerRun: (run: () => void) => void;
  useSandpackRuntime: boolean;
}

type RunState = "idle" | "running" | "ready" | "error";
type SaveState = "saving" | "saved";

interface ConsoleEntry {
  id: number;
  level: "log" | "info" | "warn" | "error";
  message: string;
}

interface StorageUpdate {
  kind: "local" | "session";
  action: "set" | "remove" | "clear";
  key?: string;
  value?: string;
}

const PLAIN_STORAGE_KEY = "framelab-plain-preview-storage-v1";
const EDITOR_LAYOUT_KEY = "framelab-editor-layout-v1";
const WORKSPACE_LAYOUT_KEY = "framelab-workspace-layout-v1";

function readStoredLayout(key: string, fallback: Layout): Layout {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
    const entries = Object.entries(value);
    if (entries.length === 0 || entries.some(([, size]) => typeof size !== "number" || !Number.isFinite(size))) {
      return fallback;
    }
    return Object.fromEntries(entries) as Layout;
  } catch {
    return fallback;
  }
}

function storeLayout(key: string, layout: Layout) {
  try {
    window.localStorage.setItem(key, JSON.stringify(layout));
  } catch {
    // Resizing should remain usable when browser storage is unavailable.
  }
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const handleChange = () => setMatches(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

function readPlainStorage(): Record<string, string> {
  const entries: Record<string, string> = Object.create(null);
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PLAIN_STORAGE_KEY) ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") entries[key] = value;
      }
    }
  } catch {
    // Storage can be blocked or cleared while the editor is open.
  }
  return entries;
}

function ActionBridge({
  onFilesChange,
  onRunStateChange,
  onSaveStateChange,
  registerRun,
  useSandpackRuntime,
}: ActionBridgeProps) {
  const { sandpack } = useSandpack();

  useEffect(() => {
    if (useSandpackRuntime) registerRun(() => sandpack.runSandpack());
  }, [registerRun, sandpack, useSandpackRuntime]);

  useEffect(() => {
    if (!useSandpackRuntime) return;
    if (sandpack.error || sandpack.status === "timeout") onRunStateChange("error");
    else if (sandpack.status === "initial" || sandpack.status === "running") onRunStateChange("running");
    else onRunStateChange("ready");
  }, [onRunStateChange, sandpack.error, sandpack.status, useSandpackRuntime]);

  useEffect(() => {
    onSaveStateChange("saving");
    const timeout = window.setTimeout(() => {
      const serializableFiles = Object.fromEntries(
        Object.entries(sandpack.files).map(([path, file]) => [path, file.code]),
      );
      onFilesChange(serializableFiles);
      onSaveStateChange("saved");
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [onFilesChange, onSaveStateChange, sandpack.files]);

  return null;
}

function buildPlainDocument(
  files: ReturnType<typeof useSandpack>["sandpack"]["files"],
  channel: string,
  storage: { local: Record<string, string>; session: Record<string, string> },
  externalResources: string[],
) {
  // Parse HTML instead of replacement strings: $&, $` and closing script
  // tags in user code must never be interpreted while composing the preview.
  const document = new DOMParser().parseFromString(files["/index.html"]?.code ?? "", "text/html");
  if (!document.querySelector('meta[name="viewport"]')) {
    const viewport = document.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width, initial-scale=1.0";
    document.head.prepend(viewport);
  }
  const dataUrl = (type: string, code: string) => `data:${type};charset=utf-8,${encodeURIComponent(code)}`;
  const localPath = (reference: string) => {
    try {
      const url = new URL(reference, "https://framelab.invalid/index.html");
      return url.origin === "https://framelab.invalid" ? decodeURIComponent(url.pathname) : null;
    } catch {
      return null; // Incomplete URLs while typing must not break the editor.
    }
  };
  const referenced = new Set<string>();
  document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]').forEach((link) => {
    const path = localPath(link.getAttribute("href")!);
    if (path && files[path]) {
      referenced.add(path);
      link.href = dataUrl("text/css", files[path].code);
    }
  });
  document.querySelectorAll<HTMLScriptElement>("script[src]").forEach((script) => {
    const path = localPath(script.getAttribute("src")!);
    if (path && files[path]) {
      referenced.add(path);
      script.src = dataUrl("text/javascript", files[path].code);
    }
  });
  // Runtime libraries are parser-blocking scripts in the document head. This
  // makes their globals available to inline code and user files in a stable,
  // declared order without document.write. Respect an explicitly included URL
  // so a pasted project never downloads or executes the same library twice.
  const existingExternalScripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"));
  const runtimeScripts = document.createDocumentFragment();
  externalResources.forEach((source) => {
    const matchingScripts = existingExternalScripts.filter((script) => script.src === source);
    const script = matchingScripts.shift() ?? document.createElement("script");
    matchingScripts.forEach((duplicate) => duplicate.remove());
    script.src = source;
    script.removeAttribute("async");
    script.removeAttribute("defer");
    script.dataset.framelabRuntimeResource = "true";
    runtimeScripts.append(script);
  });
  document.head.prepend(runtimeScripts);
  if (files["/styles.css"] && !referenced.has("/styles.css")) {
    const styles = document.createElement("link");
    styles.rel = "stylesheet";
    styles.href = dataUrl("text/css", files["/styles.css"].code);
    document.head.append(styles);
  }
  if (files["/index.js"] && !referenced.has("/index.js")) {
    const script = document.createElement("script");
    script.src = dataUrl("text/javascript", files["/index.js"].code);
    // Run after the DOM and earlier deferred dependencies, before DOMContentLoaded.
    script.defer = true;
    document.body.append(script);
  }
  const consoleBridge = `
(() => {
  const channel = ${JSON.stringify(channel)};
  // srcdoc has an opaque origin. Give ordinary browser snippets a local
  // Storage API without granting the preview access to the parent page.
  const initialStorage = ${JSON.stringify(storage).replaceAll("<", "\\u003c")};
  const createStorage = (initial, kind) => {
    const entries = Object.assign(Object.create(null), initial);
    const sync = (action, key, value) => window.parent.postMessage({
      source: "framelab-preview", channel, storage: { kind, action, key, value }
    }, "*");
    const methods = {
      get length() { return Object.keys(entries).length; },
      key(index) { return Object.keys(entries)[index] ?? null; },
      getItem(key) { key = String(key); return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null; },
      setItem(key, value) { key = String(key); value = String(value); entries[key] = value; sync("set", key, value); },
      removeItem(key) { key = String(key); delete entries[key]; sync("remove", key); },
      clear() { Object.keys(entries).forEach(key => delete entries[key]); sync("clear"); }
    };
    return new Proxy(methods, {
      get(target, key) { return key in target ? Reflect.get(target, key) : entries[key]; },
      set(target, key, value) { methods.setItem(key, value); return true; },
      deleteProperty(target, key) { methods.removeItem(key); return true; },
      ownKeys() { return Reflect.ownKeys(entries); },
      getOwnPropertyDescriptor(target, key) {
        return Object.prototype.hasOwnProperty.call(entries, key)
          ? { value: entries[key], writable: true, enumerable: true, configurable: true }
          : undefined;
      }
    });
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: createStorage(initialStorage.local, "local") });
  Object.defineProperty(window, "sessionStorage", { configurable: true, value: createStorage(initialStorage.session, "session") });
  const send = (level, values) => {
    const message = values.map(value => {
      if (typeof value === "string") return value;
      try { return JSON.stringify(value, null, 2); } catch { return String(value); }
    }).join(" ");
    window.parent.postMessage({ source: "framelab-preview", channel, level, message }, "*");
  };
  ["log", "info", "warn", "error"].forEach(level => {
    const original = console[level];
    console[level] = (...values) => { send(level, values); original.apply(console, values); };
  });
  window.addEventListener("error", event => {
    const target = event.target;
    if (target instanceof HTMLScriptElement && target.src) {
      send("error", ["Could not load runtime script: " + target.src]);
      return;
    }
    send("error", [event.message || "Unknown preview error"]);
  }, true);
  window.addEventListener("unhandledrejection", event => send("error", [event.reason]));
})();`;
  const bridge = document.createElement("script");
  bridge.textContent = consoleBridge;
  document.head.prepend(bridge);
  return `<!doctype html>${document.documentElement.outerHTML}`;
}

interface PlainPreviewProps {
  registerRun: (run: () => void) => void;
  onLogsChange: React.Dispatch<React.SetStateAction<ConsoleEntry[]>>;
  onRunStateChange: (state: RunState) => void;
  externalResources: string[];
}

function PlainPreview({ registerRun, onLogsChange, onRunStateChange, externalResources }: PlainPreviewProps) {
  const { sandpack } = useSandpack();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const runHadErrorRef = useRef(false);
  const channelRef = useRef(`preview-${Math.random().toString(36).slice(2)}`);
  const [storage] = useState(() => ({
    local: readPlainStorage(),
    session: Object.create(null) as Record<string, string>,
  }));
  const [preview, setPreview] = useState({ srcDoc: "", revision: 0 });

  const compile = useCallback(() => {
    runHadErrorRef.current = false;
    onRunStateChange("running");
    onLogsChange([]);
    const srcDoc = buildPlainDocument(sandpack.files, channelRef.current, storage, externalResources);
    setPreview((current) => ({ srcDoc, revision: current.revision + 1 }));
  }, [externalResources, onLogsChange, onRunStateChange, sandpack.files, storage]);

  useEffect(() => registerRun(compile), [compile, registerRun]);

  useEffect(() => {
    const timeout = window.setTimeout(compile, 500);
    return () => window.clearTimeout(timeout);
  }, [compile]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as Partial<ConsoleEntry> & { source?: string; channel?: string; storage?: StorageUpdate };
      if (!data || data.source !== "framelab-preview" || data.channel !== channelRef.current) return;
      if (data.storage) {
        const { kind, action, key, value } = data.storage;
        if (kind !== "local" && kind !== "session") return;
        const entries = storage[kind];
        if (action === "set" && typeof key === "string" && typeof value === "string") entries[key] = value;
        else if (action === "remove" && typeof key === "string") delete entries[key];
        else if (action === "clear") Object.keys(entries).forEach((entry) => delete entries[entry]);
        else return;
        if (kind === "local") {
          try { window.localStorage.setItem(PLAIN_STORAGE_KEY, JSON.stringify(entries)); } catch { /* Keep this session usable. */ }
        }
        return;
      }
      if (typeof data.message !== "string") return;
      const level = ["log", "info", "warn", "error"].includes(data.level ?? "")
        ? data.level as ConsoleEntry["level"]
        : "log";
      if (level === "error") {
        runHadErrorRef.current = true;
        onRunStateChange("error");
      }
      onLogsChange((current) => [...current.slice(-99), { id: Date.now() + Math.random(), level, message: data.message! }]);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onLogsChange, onRunStateChange, storage]);

  return (
    <iframe
      key={preview.revision}
      ref={iframeRef}
      className="plain-preview-iframe"
      title="HTML, CSS and JavaScript preview"
      sandbox="allow-downloads allow-forms allow-modals allow-popups allow-scripts"
      srcDoc={preview.srcDoc}
      onLoad={() => {
        if (!runHadErrorRef.current) onRunStateChange("ready");
      }}
    />
  );
}

function PlainConsole({ entries }: { entries: ConsoleEntry[] }) {
  return (
    <div className="plain-console" role="log" aria-live="polite">
      {entries.length === 0
        ? <span className="console-empty">Console output will appear here.</span>
        : entries.map((entry) => <div key={entry.id} data-level={entry.level}><span>{entry.level}</span>{entry.message}</div>)}
    </div>
  );
}

const devices: Array<{ id: DeviceId; label: string; icon: typeof Monitor }> = [
  { id: "desktop", label: "Desktop preview", icon: Monitor },
  { id: "tablet", label: "Tablet preview", icon: Laptop },
  { id: "mobile", label: "Mobile preview", icon: Smartphone },
];

export const Workspace = forwardRef<WorkspaceActions, WorkspaceProps>(function Workspace(
  { mode, files, theme, onFilesChange },
  ref,
) {
  const [device, setDevice] = useState<DeviceId>("desktop");
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(false);
  const [plainLogs, setPlainLogs] = useState<ConsoleEntry[]>([]);
  const [runState, setRunState] = useState<RunState>("idle");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [editorLayout] = useState(() => readStoredLayout(EDITOR_LAYOUT_KEY, { editor: 50, preview: 50 }));
  const [workspaceLayout] = useState(() => readStoredLayout(WORKSPACE_LAYOUT_KEY, { workbench: 76, console: 24 }));
  const isMobileWorkspace = useMediaQuery("(max-width: 780px)");
  const consolePanelRef = usePanelRef();
  const runtimeRunRef = useRef<() => void>(() => undefined);
  // Sandpack treats a new files object as a workspace reset. Keep the files
  // passed at mount stable so autosave re-renders never steal editor focus.
  // Mode, template, and reset actions intentionally remount this component.
  const initialFiles = useRef(files).current;
  const registerRun = useCallback((run: () => void) => {
    runtimeRunRef.current = run;
  }, []);
  const run = useCallback(() => {
    setRunState("running");
    runtimeRunRef.current();
  }, []);
  const storeEditorLayout = useCallback((layout: Layout) => storeLayout(EDITOR_LAYOUT_KEY, layout), []);
  const storeWorkspaceLayout = useCallback((layout: Layout) => storeLayout(WORKSPACE_LAYOUT_KEY, layout), []);

  useImperativeHandle(ref, () => ({ run }), [run]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [run]);

  useEffect(() => {
    if (!filesOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilesOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filesOpen]);

  const toggleConsole = useCallback(() => {
    if (isMobileWorkspace) {
      setConsoleOpen((open) => !open);
      return;
    }
    const panel = consolePanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setConsoleOpen(true);
    } else {
      panel.collapse();
      setConsoleOpen(false);
    }
  }, [consolePanelRef, isMobileWorkspace]);

  const errorCount = plainLogs.filter((entry) => entry.level === "error").length;
  const runStatusLabel = runState === "running"
    ? "Running"
    : runState === "error"
      ? "Needs attention"
      : runState === "ready"
        ? "Up to date"
        : "Ready to run";

  const editorPanel = (
    <section className="editor-panel" aria-label="Code editor">
      <div className="panel-heading">
        <div>
          <span className="status-dot" style={{ background: mode.accent }} />
          <strong>{mode.label}</strong>
          <span>{mode.description}</span>
        </div>
        <div className="panel-heading-actions">
          <span className="autosave-status" data-state={saveState}>{saveState === "saving" ? "Saving…" : "Saved locally"}</span>
          <button
            className="files-button"
            type="button"
            onClick={() => setFilesOpen(true)}
            aria-expanded={filesOpen}
            aria-controls="project-files-drawer"
          >
            <Files size={14} /> Files
          </button>
        </div>
      </div>
      <div className="editor-body">
        <SandpackFileExplorer autoHiddenFiles />
        <SandpackCodeEditor
          initMode="immediate"
          showRunButton={mode.id !== "vanilla"}
          showTabs
          closableTabs={false}
          showLineNumbers
          wrapContent
        />
      </div>
      {filesOpen
        ? <>
            <button
              className="files-drawer-backdrop"
              type="button"
              aria-label="Close file drawer"
              data-open="true"
              onClick={() => setFilesOpen(false)}
            />
            <aside className="files-drawer" id="project-files-drawer" data-open="true" aria-label="Project files">
              <div className="files-drawer-heading">
                <strong>Project files</strong>
                <button type="button" onClick={() => setFilesOpen(false)} aria-label="Close file drawer"><X size={16} /></button>
              </div>
              <div onClickCapture={(event) => {
                if ((event.target as HTMLElement).closest(".sp-file-explorer button")) {
                  window.setTimeout(() => setFilesOpen(false), 0);
                }
              }}>
                <SandpackFileExplorer autoHiddenFiles />
              </div>
            </aside>
          </>
        : null}
    </section>
  );

  const previewPanel = (
    <section className="preview-panel" aria-label="Live preview">
      <div className="panel-heading preview-heading">
        <div><strong>Preview</strong><span>Isolated browser runtime</span></div>
        <div className="preview-actions">
          <span className="runtime-status" data-state={runState}><span />{runStatusLabel}</span>
          <div className="device-switcher" role="group" aria-label="Preview size">
            {devices.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" data-active={device === id} onClick={() => setDevice(id)} aria-label={label} title={label}>
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="preview-canvas">
        <div className="preview-device" data-device={device}>
          {mode.id === "vanilla"
            ? <PlainPreview
                registerRun={registerRun}
                onLogsChange={setPlainLogs}
                onRunStateChange={setRunState}
                externalResources={mode.externalResources}
              />
            : <SandpackPreview showNavigator={false} showRefreshButton showOpenInCodeSandbox={false} />}
        </div>
      </div>
    </section>
  );

  const consolePanel = (
    <section className="console-panel" data-open={consoleOpen} aria-label="Console output">
      <button className="console-toggle" type="button" onClick={toggleConsole} aria-expanded={consoleOpen}>
        <span>
          <TerminalSquare size={15} /> Console
          {errorCount > 0 ? <span className="console-count">{errorCount} {errorCount === 1 ? "error" : "errors"}</span> : null}
        </span>
        {consoleOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      </button>
      {consoleOpen
        ? mode.id === "vanilla"
          ? <PlainConsole entries={plainLogs} />
          : <SandpackConsole standalone showHeader={false} />
        : null}
    </section>
  );

  return (
    <SandpackProvider
      template={mode.sandpackTemplate}
      files={initialFiles}
      theme={theme}
      options={{
        autorun: mode.id !== "vanilla",
        recompileMode: "delayed",
        recompileDelay: 600,
        externalResources: mode.id === "vanilla" ? undefined : mode.externalResources,
      }}
    >
      <ActionBridge
        onFilesChange={onFilesChange}
        onRunStateChange={setRunState}
        onSaveStateChange={setSaveState}
        registerRun={registerRun}
        useSandpackRuntime={mode.id !== "vanilla"}
      />
      <main className="studio" id="top" data-console-open={consoleOpen}>
        {isMobileWorkspace
          ? <>{editorPanel}{previewPanel}{consolePanel}</>
          : <Group
              className="workspace-group"
              orientation="vertical"
              defaultLayout={workspaceLayout}
              onLayoutChanged={storeWorkspaceLayout}
              resizeTargetMinimumSize={{ fine: 10, coarse: 24 }}
            >
              <Panel id="workbench" minSize="45%">
                <Group
                  className="workspace-group"
                  orientation="horizontal"
                  defaultLayout={editorLayout}
                  onLayoutChanged={storeEditorLayout}
                  resizeTargetMinimumSize={{ fine: 10, coarse: 24 }}
                >
                  <Panel id="editor" minSize="34%">{editorPanel}</Panel>
                  <Separator className="resize-handle resize-handle-column" aria-label="Resize editor and preview" />
                  <Panel id="preview" minSize="34%">{previewPanel}</Panel>
                </Group>
              </Panel>
              <Separator className="resize-handle resize-handle-row" aria-label="Resize console" />
              <Panel
                id="console"
                panelRef={consolePanelRef}
                minSize="120px"
                collapsedSize="38px"
                collapsible
                onResize={(size) => setConsoleOpen(size.inPixels > 40)}
              >
                {consolePanel}
              </Panel>
            </Group>}
      </main>
    </SandpackProvider>
  );
});
