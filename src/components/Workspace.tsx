import {
  SandpackCodeEditor,
  SandpackConsole,
  SandpackFileExplorer,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { ChevronDown, ChevronUp, Laptop, Monitor, Smartphone, TerminalSquare } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { SandpackFiles } from "@codesandbox/sandpack-react";
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
  registerRun: (run: () => void) => void;
  useSandpackRuntime: boolean;
}

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

function ActionBridge({ onFilesChange, registerRun, useSandpackRuntime }: ActionBridgeProps) {
  const { sandpack } = useSandpack();

  useEffect(() => {
    if (useSandpackRuntime) registerRun(() => sandpack.runSandpack());
  }, [registerRun, sandpack, useSandpackRuntime]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const serializableFiles = Object.fromEntries(
        Object.entries(sandpack.files).map(([path, file]) => [path, file.code]),
      );
      onFilesChange(serializableFiles);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [onFilesChange, sandpack.files]);

  return null;
}

function buildPlainDocument(
  files: ReturnType<typeof useSandpack>["sandpack"]["files"],
  channel: string,
  storage: { local: Record<string, string>; session: Record<string, string> },
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
  window.addEventListener("error", event => send("error", [event.message]));
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
}

function PlainPreview({ registerRun, onLogsChange }: PlainPreviewProps) {
  const { sandpack } = useSandpack();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const channelRef = useRef(`preview-${Math.random().toString(36).slice(2)}`);
  const [storage] = useState(() => ({
    local: readPlainStorage(),
    session: Object.create(null) as Record<string, string>,
  }));
  const [preview, setPreview] = useState({ srcDoc: "", revision: 0 });

  const compile = useCallback(() => {
    onLogsChange([]);
    const srcDoc = buildPlainDocument(sandpack.files, channelRef.current, storage);
    setPreview((current) => ({ srcDoc, revision: current.revision + 1 }));
  }, [onLogsChange, sandpack.files, storage]);

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
      onLogsChange((current) => [...current.slice(-99), { id: Date.now() + Math.random(), level, message: data.message! }]);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onLogsChange, storage]);

  return (
    <iframe
      key={preview.revision}
      ref={iframeRef}
      className="plain-preview-iframe"
      title="HTML, CSS and JavaScript preview"
      sandbox="allow-downloads allow-forms allow-modals allow-popups allow-scripts"
      srcDoc={preview.srcDoc}
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
  const [plainLogs, setPlainLogs] = useState<ConsoleEntry[]>([]);
  const runtimeRunRef = useRef<() => void>(() => undefined);
  // Sandpack treats a new files object as a workspace reset. Keep the files
  // passed at mount stable so autosave re-renders never steal editor focus.
  // Mode, template, and reset actions intentionally remount this component.
  const initialFiles = useRef(files).current;
  const registerRun = useCallback((run: () => void) => {
    runtimeRunRef.current = run;
  }, []);

  useImperativeHandle(ref, () => ({ run: () => runtimeRunRef.current() }), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        runtimeRunRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <SandpackProvider
      template={mode.sandpackTemplate}
      files={initialFiles}
      theme={theme}
      options={{
        autorun: mode.id !== "vanilla",
        recompileMode: "delayed",
        recompileDelay: 600,
      }}
    >
      <ActionBridge
        onFilesChange={onFilesChange}
        registerRun={registerRun}
        useSandpackRuntime={mode.id !== "vanilla"}
      />
      <main className="studio" id="top">
        <section className="editor-panel" aria-label="Code editor">
          <div className="panel-heading">
            <div>
              <span className="status-dot" style={{ background: mode.accent }} />
              <strong>{mode.label}</strong>
              <span>{mode.description}</span>
            </div>
            <span className="autosave-status">Saved locally</span>
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
        </section>

        <section className="preview-panel" aria-label="Live preview">
          <div className="panel-heading preview-heading">
            <div><strong>Preview</strong><span>Isolated browser runtime</span></div>
            <div className="device-switcher" role="group" aria-label="Preview size">
              {devices.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" data-active={device === id} onClick={() => setDevice(id)} aria-label={label} title={label}>
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>
          <div className="preview-canvas">
            <div className="preview-device" data-device={device}>
              {mode.id === "vanilla"
                ? <PlainPreview registerRun={registerRun} onLogsChange={setPlainLogs} />
                : <SandpackPreview showNavigator={false} showRefreshButton showOpenInCodeSandbox={false} />}
            </div>
          </div>
        </section>

        <section className="console-panel" data-open={consoleOpen} aria-label="Console output">
          <button className="console-toggle" type="button" onClick={() => setConsoleOpen((open) => !open)} aria-expanded={consoleOpen}>
            <span><TerminalSquare size={15} /> Console</span>
            {consoleOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
          {consoleOpen
            ? mode.id === "vanilla"
              ? <PlainConsole entries={plainLogs} />
              : <SandpackConsole standalone showHeader={false} />
            : null}
        </section>
      </main>
    </SandpackProvider>
  );
});
