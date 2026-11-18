export type ReplayStatus = 'idle' | 'selecting_cutoff' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended';

export interface ReplayBounds {
  first: number;
  last: number;
}

export interface ReplaySnapshot {
  active: boolean;
  status: ReplayStatus;
  isPlaying: boolean;
  isSelectingBar: boolean;
  playbackSpeed: number;
  cutoffTime: number | null;
  cursorTime: number | null;
  remainingBars: number;
  totalReplayBars: number;
  currentStepIndex: number;
  bounds: ReplayBounds | null;
  errorMessage: string | null;
}

export interface ReplayDriverState {
  active: boolean;
  playing: boolean;
  cursorTime: number | null;
  remaining: number;
}

/**
 * Driver Seam: mengabstraksi komunikasi antara ReplaySession dan engine chart
 * agar testing headless dapat berjalan tanpa WebGL atau DOM.
 */
export interface ReplayDriver {
  getBounds(): ReplayBounds | null;
  start(targetTime: number): Promise<boolean>;
  seekTo?(targetTime: number): Promise<boolean>;
  skipToEnd?(): Promise<boolean>;
  play(intervalMs: number): void;
  pause(): void;
  step(count?: number): void | Promise<void>;
  stepBack(count?: number): void | Promise<void>;
  stop(): void;
  getState(): ReplayDriverState | null;
  enableCutoffVisual(): void;
  cancelCutoffVisual(): void;
}

export type ReplayListener = (snapshot: ReplaySnapshot) => void;

export interface IReplaySession {
  open(): void;
  close(): void;
  enableBarSelection(): void;
  cancelBarSelection(): void;
  setCutoff(timestamp: number): Promise<boolean>;
  seekTo(timestamp: number): Promise<boolean>;
  skipToEnd(): Promise<boolean>;
  play(speed?: number): void;
  pause(): void;
  togglePlay(): void;
  step(count?: number): void;
  stepBack(count?: number): void;
  setSpeed(speed: number): void;
  rewind(): Promise<boolean>;
  clearError(): void;
  bindDriver(driver: ReplayDriver | null): void;
  notifyDriverState(state: {
    active?: boolean;
    playing?: boolean;
    cursorTime?: number | null;
    remaining?: number;
    bounds?: ReplayBounds | null;
    errorMessage?: string | null;
  }): void;
  subscribe(listener: ReplayListener): () => void;
  getSnapshot(): ReplaySnapshot;
}
