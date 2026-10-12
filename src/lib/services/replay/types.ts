// Tipe dan Kontrak Antarmuka Modul Deep Replay Session Trawangan
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
  bounds: ReplayBounds | null;
}

/**
 * Driver Seam: Mengabstraksi komunikasi antara ReplaySession dan engine chart
 * Memungkinkan testing headless tanpa memuat canvas WebGL atau DOM.
 */
export interface ReplayDriver {
  getBounds(): ReplayBounds | null;
  start(targetTime: number): Promise<boolean>;
  play(intervalMs: number): void;
  pause(): void;
  step(): void;
  stepBack(): void;
  stop(): void;
  getState(): { active: boolean; playing: boolean; cursorTime: number | null; remaining: number } | null;
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
  play(speed?: number): void;
  pause(): void;
  togglePlay(): void;
  step(): void;
  stepBack(): void;
  setSpeed(speed: number): void;
  rewind(): Promise<boolean>;
  bindDriver(driver: ReplayDriver | null): void;
  notifyDriverState(state: {
    active?: boolean;
    playing?: boolean;
    cursorTime?: number | null;
    remaining?: number;
    bounds?: ReplayBounds | null;
  }): void;
  subscribe(listener: ReplayListener): () => void;
  getSnapshot(): ReplaySnapshot;
}
