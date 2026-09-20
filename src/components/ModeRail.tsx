import { Braces, Code2, Component, Github, RotateCcw } from "lucide-react";
import { PLAYGROUND_MODES } from "../data/templates";
import type { ModeId } from "../types";

const modeIcons = {
  vanilla: Code2,
  react: Component,
  angular: Braces,
};

interface ModeRailProps {
  activeMode: ModeId;
  onModeChange: (mode: ModeId) => void;
  onReset: () => void;
}

export function ModeRail({ activeMode, onModeChange, onReset }: ModeRailProps) {
  return (
    <aside className="mode-rail" aria-label="Framework modes">
      <nav>
        {PLAYGROUND_MODES.map((mode) => {
          const Icon = modeIcons[mode.id];
          return (
            <button
              key={mode.id}
              className="mode-button"
              data-active={activeMode === mode.id}
              style={{ "--mode-accent": mode.accent } as React.CSSProperties}
              type="button"
              onClick={() => onModeChange(mode.id)}
              aria-pressed={activeMode === mode.id}
            >
              <Icon size={19} />
              <span>{mode.shortLabel}</span>
            </button>
          );
        })}
      </nav>
      <div className="rail-footer">
        <button type="button" onClick={onReset} aria-label="Reset current playground" title="Reset current playground">
          <RotateCcw size={18} />
        </button>
        <a href="https://github.com/Kanish2002/JS-Frameworks" target="_blank" rel="noreferrer" aria-label="View project on GitHub" title="View on GitHub">
          <Github size={18} />
        </a>
      </div>
    </aside>
  );
}
