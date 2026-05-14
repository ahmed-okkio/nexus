export type AiState = "idle" | "listening" | "thinking" | "responding";

export type HudPanelData = {
  id: string;
  title: string;
  badge?: string;
  items: Array<{
    label: string;
    sublabel: string;
  }>;
  action: string;
};
