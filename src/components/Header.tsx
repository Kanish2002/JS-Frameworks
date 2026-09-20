import { Check, ChevronDown, Download, Moon, Play, Share2, Sun } from "lucide-react";
import { BrandMark } from "./BrandMark";
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
        <button className="run-button" type="button" onClick={onRun}>
          <Play size={15} fill="currentColor" />
          Run
          <kbd>⌘↵</kbd>
        </button>
      </div>
    </header>
  );
}
