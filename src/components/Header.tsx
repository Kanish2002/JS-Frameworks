import { Check, ChevronDown, Download, Moon, MoreHorizontal, Play, Share2, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "./BrandMark";
import { getRunShortcutLabel } from "../utils/platform";
import type { PlaygroundMode, ThemeId } from "../types";

interface HeaderProps {
  mode: PlaygroundMode;
  selectedTemplateId: string;
  theme: ThemeId;
  copied: boolean;
  onTemplateChange: (templateId: string) => void;
  onRun: () => void;
  onShare: () => void;
  onDownload: () => void;
  onThemeToggle: () => void;
}

export function Header({
  mode,
  selectedTemplateId,
  theme,
  copied,
  onTemplateChange,
  onRun,
  onShare,
  onDownload,
  onThemeToggle,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const runShortcut = getRunShortcutLabel();

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const runAndClose = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  return (
    <header className="app-header">
      <a className="brand" href="#top" aria-label="FrameLab home">
        <BrandMark />
        <span>FrameLab</span>
        <small>beta</small>
      </a>

      <div className="project-context">
        <span className="context-label">Playground</span>
        <span className="context-slash">/</span>
        <label className="template-select">
          <span className="sr-only">Choose a starter template</span>
          <select value={selectedTemplateId} onChange={(event) => onTemplateChange(event.target.value)}>
            {mode.templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
      </div>

      <div className="header-actions">
        <button className="icon-button secondary-action" type="button" onClick={onThemeToggle} aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button className="icon-button secondary-action" type="button" onClick={onDownload} aria-label="Download project as ZIP">
          <Download size={17} />
        </button>
        <button className="text-button secondary-action" type="button" onClick={onShare}>
          {copied ? <Check size={16} /> : <Share2 size={16} />}
          <span>{copied ? "Copied" : "Share"}</span>
        </button>
        <div className="mobile-actions" ref={menuRef}>
          <button
            className="icon-button mobile-actions-toggle"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close project actions" : "Open project actions"}
            aria-expanded={menuOpen}
            aria-controls="mobile-project-actions"
          >
            {menuOpen ? <X size={18} /> : <MoreHorizontal size={19} />}
          </button>
          <div className="mobile-actions-menu" id="mobile-project-actions" data-open={menuOpen}>
            <label>
              <span>Starter template</span>
              <span className="mobile-template-select">
                <select value={selectedTemplateId} onChange={(event) => runAndClose(() => onTemplateChange(event.target.value))}>
                  {mode.templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </span>
            </label>
            <button type="button" onClick={() => runAndClose(onThemeToggle)}>
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              Use {theme === "dark" ? "light" : "dark"} theme
            </button>
            <button type="button" onClick={() => runAndClose(onDownload)}><Download size={17} /> Download project</button>
            <button type="button" onClick={() => runAndClose(onShare)}>
              {copied ? <Check size={17} /> : <Share2 size={17} />}
              {copied ? "Link copied" : "Copy share link"}
            </button>
          </div>
        </div>
        <button className="run-button" type="button" onClick={onRun} aria-label={`Run project (${runShortcut})`}>
          <Play size={15} fill="currentColor" />
          Run
          <kbd>{runShortcut}</kbd>
        </button>
      </div>
    </header>
  );
}
