export type SpeechStatus = "idle" | "listening" | "transcribing";

export interface SpeechState {
  status: SpeechStatus;
  interim: string;
  error: string | null;
  modelError: boolean;
  progress: number | null;
  detail: string | null;
}

export const INITIAL_SPEECH_STATE: SpeechState = {
  status: "idle",
  interim: "",
  error: null,
  modelError: false,
  progress: null,
  detail: null,
};

export type SpeechAction =
  | { type: "start" }
  | { type: "transcribing" }
  | { type: "interim"; text: string }
  | { type: "modelProgress"; percent: number | null }
  | { type: "detail"; message: string }
  | { type: "end" }
  | { type: "error"; message: string; model?: boolean }
  | { type: "clearModel" };

export function speechReducer(
  state: SpeechState,
  action: SpeechAction,
): SpeechState {
  switch (action.type) {
    case "start":
      return {
        ...state,
        status: "listening",
        interim: "",
        error: null,
        detail: null,
        progress: null,
        modelError: false,
      };
    case "transcribing":
      return {
        ...state,
        status: "transcribing",
        interim: "",
        detail: null,
        progress: null,
        modelError: false,
      };
    case "interim":
      return { ...state, interim: action.text };
    case "modelProgress":
      return { ...state, progress: action.percent };
    case "detail":
      return { ...state, detail: action.message };
    case "end":
      return { ...state, status: "idle", interim: "", detail: null, progress: null };
    case "error":
      return {
        ...state,
        status: "idle",
        interim: "",
        detail: null,
        progress: null,
        modelError: action.model ?? false,
        error: action.message,
      };
    case "clearModel":
      return { ...state, error: null, modelError: false };
  }
}
