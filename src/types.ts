import type { SandpackFiles, SandpackPredefinedTemplate } from "@codesandbox/sandpack-react";

export type ModeId = "vanilla" | "react" | "angular";
export type DeviceId = "desktop" | "tablet" | "mobile";
export type ThemeId = "dark" | "light";

export interface PlaygroundTemplate {
  id: string;
  name: string;
  description: string;
  files: SandpackFiles;
}

export interface PlaygroundMode {
  id: ModeId;
  label: string;
  shortLabel: string;
  description: string;
  accent: string;
  sandpackTemplate: SandpackPredefinedTemplate;
  templates: PlaygroundTemplate[];
}

export type SavedWorkspaces = Partial<Record<ModeId, SandpackFiles>>;
