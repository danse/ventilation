export type ProgressInfo = {
  status?: string;
  progress?: number;
  file?: string;
  name?: string;
  loaded?: number;
  total?: number;
};

export type ProgressUpdate =
  | { kind: "set"; percent: number }
  | { kind: "clear" }
  | { kind: "none" };

/**
 * Maps a transformers.js progress callback event to a UI update.
 *
 * Only the aggregate `progress_total` event (which already sums all files
 * downloaded in parallel) drives the bar; the raw per-file `progress` and
 * per-file `done` events are ignored so the bar does not jump backwards or
 * vanish between files. The single `ready` event clears the bar.
 */
export function resolveProgressUpdate(info: ProgressInfo): ProgressUpdate {
  if (info.status === "progress_total" && typeof info.progress === "number") {
    return { kind: "set", percent: info.progress };
  }
  if (info.status === "ready") {
    return { kind: "clear" };
  }
  return { kind: "none" };
}

export type Transcriber = (audio: Float32Array) => Promise<{ text?: string }>;

export type ModelLoader = (
  onProgress: (info: ProgressInfo) => void,
) => Promise<Transcriber>;

/**
 * Owns the (shared) model-loading promise. Deduplicates concurrent loads,
 * retries after a failure, and forwards progress events as bar percentages.
 */
export class TranscriberManager {
  private promise: Promise<Transcriber> | null = null;
  private onPercent: (percent: number | null) => void = () => {};
  private readonly loadModel: ModelLoader;

  constructor(loadModel: ModelLoader) {
    this.loadModel = loadModel;
  }

  get(onPercent: (percent: number | null) => void): Promise<Transcriber> {
    this.onPercent = onPercent;
    if (!this.promise) {
      this.promise = this.loadModel((info) => {
        const update = resolveProgressUpdate(info);
        if (update.kind === "set") {
          this.onPercent(update.percent);
        } else if (update.kind === "clear") {
          this.onPercent(null);
        }
      }).catch((error: unknown) => {
        this.promise = null;
        throw error;
      });
    }
    return this.promise;
  }

  reset() {
    this.promise = null;
  }
}
