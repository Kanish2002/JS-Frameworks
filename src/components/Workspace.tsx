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

function buildPlainDocument(files: ReturnType<typeof useSandpack>["sandpack"]["files"], channel: string) {
  const html = files["/index.html"]?.code ?? "";
  const css = files["/styles.css"]?.code ?? "";
  const javascript = files["/index.js"]?.code ?? "";
  const cleanHtml = html
    .replace(/<link\b[^>]*href=["']\/?styles\.css["'][^>]*>/gi, "")
    .replace(/<script\b[^>]*src=["']\/?index\.js["'][^>]*><\/script>/gi, "");
  const consoleBridge = `<script>
(() => {
  const channel = ${JSON.stringify(channel)};
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
})();
<\/script>`;
  const styles = `<style>${css}</style>`;
  const script = `<script>${javascript}<\/script>`;

  if (/<(?:!doctype|html)\b/i.test(cleanHtml)) {
    const withStyles = /<\/head>/i.test(cleanHtml)
      ? cleanHtml.replace(/<\/head>/i, `${styles}</head>`)
      : `${styles}${cleanHtml}`;
    return /<\/body>/i.test(withStyles)
      ? withStyles.replace(/<\/body>/i, `${consoleBridge}${script}</body>`)
      : `${withStyles}${consoleBridge}${script}`;
  }

  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${styles}</head><body>${cleanHtml}${consoleBridge}${script}</body></html>`;
}

interface PlainPreviewProps {
  registerRun: (run: () => void) => void;
  onLogsChange: React.Dispatch<React.SetStateAction<ConsoleEntry[]>>;
}

function PlainPreview({ registerRun, onLogsChange }: PlainPreviewProps) {
  const { sandpack } = useSandpack();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const channelRef = useRef(`preview-${Math.random().toString(36).slice(2)}`);
  const [srcDoc, setSrcDoc] = useState("");

  const compile = useCallback(() => {
    onLogsChange([]);
    setSrcDoc(buildPlainDocument(sandpack.files, channelRef.current));
  }, [onLogsChange, sandpack.files]);

  useEffect(() => registerRun(compile), [compile, registerRun]);

  useEffect(() => {
    const timeout = window.setTimeout(compile, 500);
    return () => window.clearTimeout(timeout);
  }, [compile]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as Partial<ConsoleEntry> & { source?: string; channel?: string };
      if (data.source !== "framelab-preview" || data.channel !== channelRef.current || !data.message) return;
      const level = ["log", "info", "warn", "error"].includes(data.level ?? "")
        ? data.level as ConsoleEntry["level"]
        : "log";
      onLogsChange((current) => [...current.slice(-99), { id: Date.now() + Math.random(), level, message: data.message! }]);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onLogsChange]);

  return (
    <iframe
      ref={iframeRef}
      className="plain-preview-iframe"
      title="HTML, CSS and JavaScript preview"
      sandbox="allow-downloads allow-forms allow-modals allow-popups allow-scripts"
      srcDoc={srcDoc}
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
