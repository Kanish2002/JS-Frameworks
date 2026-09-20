import {
  SandpackCodeEditor,
  SandpackConsole,
  SandpackFileExplorer,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { ChevronDown, ChevronUp, Laptop, Monitor, Smartphone, TerminalSquare } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
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
}

const ActionBridge = forwardRef<WorkspaceActions, ActionBridgeProps>(function ActionBridge(
  { onFilesChange },
  ref,
) {
  const { sandpack } = useSandpack();

  useImperativeHandle(ref, () => ({
    run: () => sandpack.runSandpack(),
  }), [sandpack]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        sandpack.runSandpack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sandpack]);

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
});

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
  // Sandpack treats a new files object as a workspace reset. Keep the files
  // passed at mount stable so autosave re-renders never steal editor focus.
  // Mode, template, and reset actions intentionally remount this component.
  const initialFiles = useRef(files).current;

  return (
    <SandpackProvider
      template={mode.sandpackTemplate}
      files={initialFiles}
      theme={theme}
      options={{
        autorun: true,
        recompileMode: "delayed",
        recompileDelay: 600,
      }}
    >
      <ActionBridge ref={ref} onFilesChange={onFilesChange} />
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
              <SandpackPreview showNavigator={false} showRefreshButton showOpenInCodeSandbox={false} />
            </div>
          </div>
        </section>

        <section className="console-panel" data-open={consoleOpen} aria-label="Console output">
          <button className="console-toggle" type="button" onClick={() => setConsoleOpen((open) => !open)} aria-expanded={consoleOpen}>
            <span><TerminalSquare size={15} /> Console</span>
            {consoleOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
          {consoleOpen ? <SandpackConsole standalone showHeader={false} /> : null}
        </section>
      </main>
    </SandpackProvider>
  );
});
