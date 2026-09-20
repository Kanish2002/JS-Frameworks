import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SandpackFiles } from "@codesandbox/sandpack-react";
import { Header } from "./components/Header";
import { ModeRail } from "./components/ModeRail";
import type { WorkspaceActions } from "./components/Workspace";
import { PLAYGROUND_MODES, getMode } from "./data/templates";
import { usePersistentState } from "./hooks/usePersistentState";
import type { ModeId, SavedWorkspaces, ThemeId } from "./types";

const STORAGE_KEY = "framelab-workspaces-v2";

const Workspace = lazy(() =>
  import("./components/Workspace").then((module) => ({ default: module.Workspace })),
);

const defaultTemplateIds = Object.fromEntries(
  PLAYGROUND_MODES.map((mode) => [mode.id, mode.templates[0].id]),
) as Record<ModeId, string>;

function normalizeFiles(files: SandpackFiles): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, file]) => [path, typeof file === "string" ? file : file.code]),
  );
}

function encodeSharePayload(mode: ModeId, files: SandpackFiles) {
  const bytes = new TextEncoder().encode(JSON.stringify({ mode, files: normalizeFiles(files) }));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function readSharePayload(): { mode: ModeId; files: SandpackFiles } | null {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get("share");
  if (!encoded) return null;

  try {
    const padded = encoded.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { mode: ModeId; files: Record<string, string> };
    if (!PLAYGROUND_MODES.some((mode) => mode.id === parsed.mode) || !parsed.files) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function App() {
  const sharedPayload = useMemo(readSharePayload, []);
  const [activeMode, setActiveMode] = useState<ModeId>(sharedPayload?.mode ?? "vanilla");
  const [theme, setTheme] = usePersistentState<ThemeId>("framelab-theme", "dark");
  const [savedWorkspaces, setSavedWorkspaces] = usePersistentState<SavedWorkspaces>(
    STORAGE_KEY,
    {},
  );
  const [templateIds, setTemplateIds] = useState(defaultTemplateIds);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(sharedPayload ? "Shared playground loaded" : "");
  const workspaceRef = useRef<WorkspaceActions>(null);

  const mode = getMode(activeMode);
  const selectedTemplateId = templateIds[activeMode];
  const selectedTemplate = mode.templates.find((template) => template.id === selectedTemplateId) ?? mode.templates[0];
  const activeFiles = savedWorkspaces[activeMode] ?? selectedTemplate.files;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!sharedPayload) return;
    setSavedWorkspaces((current) => ({
      ...current,
      [sharedPayload.mode]: sharedPayload.files,
    }));
    setWorkspaceRevision((revision) => revision + 1);
  }, [setSavedWorkspaces, sharedPayload]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleFilesChange = useCallback((files: SandpackFiles) => {
    setSavedWorkspaces((current) => ({ ...current, [activeMode]: files }));
  }, [activeMode, setSavedWorkspaces]);

  const handleModeChange = useCallback((nextMode: ModeId) => {
    setActiveMode(nextMode);
    setWorkspaceRevision((revision) => revision + 1);
  }, []);

  const handleTemplateChange = useCallback((templateId: string) => {
    const template = mode.templates.find((item) => item.id === templateId);
    if (!template) return;
    setTemplateIds((current) => ({ ...current, [activeMode]: templateId }));
    setSavedWorkspaces((current) => ({ ...current, [activeMode]: template.files }));
    setWorkspaceRevision((revision) => revision + 1);
    setToast(`${template.name} loaded`);
  }, [activeMode, mode.templates, setSavedWorkspaces]);

  const handleReset = useCallback(() => {
    if (!window.confirm(`Reset the ${mode.label} workspace to ${selectedTemplate.name}?`)) return;
    setSavedWorkspaces((current) => ({ ...current, [activeMode]: selectedTemplate.files }));
    setWorkspaceRevision((revision) => revision + 1);
    setToast("Playground reset");
  }, [activeMode, mode.label, selectedTemplate, setSavedWorkspaces]);

  const handleShare = useCallback(async () => {
    const encoded = encodeSharePayload(activeMode, activeFiles);
    const url = new URL(window.location.href);
    url.hash = `share=${encoded}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setToast("Share link copied");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.history.replaceState(null, "", url);
      setToast("Share link added to the address bar");
    }
  }, [activeFiles, activeMode]);

  const handleDownload = useCallback(async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const [path, code] of Object.entries(normalizeFiles(activeFiles))) {
      zip.file(path.replace(/^\//, ""), code);
    }
    zip.file("README.md", `# FrameLab export\n\nExported from the ${mode.label} playground.\n`);
    const blob = await zip.generateAsync({ type: "blob" });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `framelab-${activeMode}.zip`;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
    setToast("Project downloaded");
  }, [activeFiles, activeMode, mode.label]);

  return (
    <div className="app-shell">
      <Header
        mode={mode}
        selectedTemplateId={selectedTemplateId}
        theme={theme}
        copied={copied}
        onTemplateChange={handleTemplateChange}
        onRun={() => workspaceRef.current?.run()}
        onShare={handleShare}
        onDownload={handleDownload}
        onThemeToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")}
      />
      <ModeRail activeMode={activeMode} onModeChange={handleModeChange} onReset={handleReset} />
      <Suspense fallback={<div className="workspace-loading"><span />Loading the playground…</div>}>
        <Workspace
          key={`${activeMode}-${selectedTemplateId}-${workspaceRevision}`}
          ref={workspaceRef}
          mode={mode}
          files={activeFiles}
          theme={theme}
          onFilesChange={handleFilesChange}
        />
      </Suspense>
      <div className="keyboard-hint" aria-hidden="true">Tip: press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run</div>
      <div className="toast" role="status" data-visible={Boolean(toast)}>{toast}</div>
    </div>
  );
}
