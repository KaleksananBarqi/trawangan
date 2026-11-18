import type {
  IReplaySession,
  ReplayBounds,
  ReplayDriver,
  ReplayListener,
  ReplaySnapshot,
  ReplayStatus,
} from './types';

export const REPLAY_SPEED_OPTIONS = [0.5, 1, 2, 5, 10, 20] as const;

export class ReplaySession implements IReplaySession {
  private active = false;
  private status: ReplayStatus = 'idle';
  private isPlaying = false;
  private isSelectingBar = false;
  private playbackSpeed = 1;
  private cutoffTime: number | null = null;
  private cursorTime: number | null = null;
  private remainingBars = 0;
  private totalReplayBars = 0;
  private bounds: ReplayBounds | null = null;
  private errorMessage: string | null = null;

  private driver: ReplayDriver | null = null;
  private listeners = new Set<ReplayListener>();

  public bindDriver(driver: ReplayDriver | null): void {
    this.driver = driver;
    if (this.driver) {
      const b = this.driver.getBounds();
      if (b) {
        this.bounds = b;
      }
      if (this.isSelectingBar) {
        this.driver.enableCutoffVisual();
      }
    }
    this.emit();
  }

  public notifyDriverState(state: {
    active?: boolean;
    playing?: boolean;
    cursorTime?: number | null;
    remaining?: number;
    bounds?: ReplayBounds | null;
    errorMessage?: string | null;
  }): void {
    if (state.active !== undefined) {
      this.active = state.active;
      if (!state.active && !this.isSelectingBar && this.status !== 'loading') {
        this.isPlaying = false;
      }
    }
    if (state.playing !== undefined) {
      this.isPlaying = state.playing;
      if (this.isPlaying) {
        this.status = 'playing';
      } else if (this.active && this.status === 'playing') {
        this.status = this.remainingBars <= 0 ? 'ended' : 'paused';
      }
    }
    if (state.cursorTime !== undefined) this.cursorTime = state.cursorTime;
    if (state.remaining !== undefined) {
      this.remainingBars = Math.max(0, state.remaining);
      if (this.remainingBars > this.totalReplayBars) {
        this.totalReplayBars = this.remainingBars;
      }
      if (this.remainingBars <= 0 && this.status === 'playing') {
        this.status = 'ended';
        this.isPlaying = false;
      }
    }
    if (state.bounds !== undefined) this.bounds = state.bounds;
    if (state.errorMessage !== undefined) this.errorMessage = state.errorMessage;

    this.emit();
  }

  public open(): void {
    this.active = true;
    this.isPlaying = false;
    this.isSelectingBar = true;
    this.errorMessage = null;
    this.status = 'selecting_cutoff';

    if (this.driver) {
      const b = this.driver.getBounds();
      if (b) this.bounds = b;
      this.driver.enableCutoffVisual();
    }
    this.emit();
  }

  public close(): void {
    this.active = false;
    this.isPlaying = false;
    this.isSelectingBar = false;
    this.status = 'idle';
    this.cutoffTime = null;
    this.cursorTime = null;
    this.remainingBars = 0;
    this.totalReplayBars = 0;
    this.errorMessage = null;

    if (this.driver) {
      this.driver.stop();
      this.driver.cancelCutoffVisual();
    }
    this.emit();
  }

  public enableBarSelection(): void {
    if (!this.active) this.active = true;
    if (this.isPlaying) {
      this.pause();
    }
    this.isSelectingBar = true;
    this.errorMessage = null;
    this.status = 'selecting_cutoff';

    if (this.driver) {
      this.driver.enableCutoffVisual();
    }
    this.emit();
  }

  public cancelBarSelection(): void {
    this.isSelectingBar = false;
    if (this.cutoffTime !== null) {
      this.status = this.remainingBars <= 0 ? 'ended' : this.isPlaying ? 'playing' : 'paused';
    } else {
      this.status = 'idle';
      this.active = false;
    }

    if (this.driver) {
      this.driver.cancelCutoffVisual();
    }
    this.emit();
  }

  public clearError(): void {
    if (this.errorMessage !== null) {
      this.errorMessage = null;
      this.emit();
    }
  }

  private async applyTargetTimestamp(timestamp: number, mode: 'cutoff' | 'seek'): Promise<boolean> {
    const isCutoff = mode === 'cutoff';
    if (!isCutoff && !this.active) return false;
    if (this.isPlaying) {
      this.pause();
    }

    this.active = true;
    this.isSelectingBar = false;
    this.isPlaying = false;
    this.errorMessage = null;

    const prevCutoff = this.cutoffTime;
    const prevCursor = this.cursorTime;
    if (isCutoff) {
      this.cutoffTime = timestamp;
      this.cursorTime = timestamp;
    }
    this.status = 'loading';
    this.emit();

    if (!this.driver) {
      this.cursorTime = timestamp;
      this.status = isCutoff ? 'ready' : 'paused';
      this.emit();
      return true;
    }

    this.driver.cancelCutoffVisual();
    const ok = !isCutoff && this.driver.seekTo
      ? await this.driver.seekTo(timestamp)
      : await this.driver.start(timestamp);
    const driverBounds = this.driver.getBounds();
    if (driverBounds) this.bounds = driverBounds;

    if (ok) {
      const state = this.driver.getState();
      if (state) {
        this.cursorTime = state.cursorTime ?? timestamp;
        if (isCutoff) {
          this.cutoffTime = state.cursorTime ?? timestamp;
        }
        this.remainingBars = Math.max(0, state.remaining);
        if (isCutoff) {
          this.totalReplayBars = this.remainingBars;
        } else if (this.remainingBars > this.totalReplayBars) {
          this.totalReplayBars = this.remainingBars;
        }
        this.isPlaying = state.playing;
      }
      this.status = this.remainingBars <= 0 ? 'ended' : isCutoff ? 'ready' : 'paused';
    } else {
      if (isCutoff) {
        this.cutoffTime = prevCutoff;
        this.cursorTime = prevCursor;
        this.status = prevCutoff !== null ? 'paused' : 'selecting_cutoff';
        if (prevCutoff === null) {
          this.isSelectingBar = true;
          this.driver.enableCutoffVisual();
        }
      } else {
        this.status = this.remainingBars <= 0 ? 'ended' : 'paused';
      }
      if (!this.errorMessage) {
        this.errorMessage = isCutoff
          ? 'Gagal memuat candle pada tanggal tersebut.'
          : 'Gagal melompat ke posisi waktu tersebut.';
      }
    }

    this.emit();
    return ok;
  }

  public setCutoff(timestamp: number): Promise<boolean> {
    return this.applyTargetTimestamp(timestamp, 'cutoff');
  }

  public seekTo(timestamp: number): Promise<boolean> {
    return this.applyTargetTimestamp(timestamp, 'seek');
  }

  public async skipToEnd(): Promise<boolean> {
    if (!this.active) return false;
    if (this.isPlaying) {
      this.pause();
    }
    this.isSelectingBar = false;
    this.errorMessage = null;

    if (this.driver) {
      this.driver.cancelCutoffVisual();
      const ok = this.driver.skipToEnd
        ? await this.driver.skipToEnd()
        : this.bounds
          ? await this.driver.start(this.bounds.last)
          : false;

      const state = this.driver.getState();
      if (state) {
        this.cursorTime = state.cursorTime ?? this.bounds?.last ?? this.cursorTime;
        this.remainingBars = Math.max(0, state.remaining);
      } else if (this.bounds) {
        this.cursorTime = this.bounds.last;
        this.remainingBars = 0;
      }
      this.isPlaying = false;
      this.status = this.remainingBars <= 0 ? 'ended' : 'paused';
      this.emit();
      return ok;
    }

    if (this.bounds) {
      this.cursorTime = this.bounds.last;
    }
    this.remainingBars = 0;
    this.isPlaying = false;
    this.status = 'ended';
    this.emit();
    return true;
  }

  public play(speed?: number): void {
    if (speed !== undefined) {
      this.playbackSpeed = speed;
    }
    if (this.remainingBars <= 0 && this.status === 'ended') {
      return;
    }
    this.isPlaying = true;
    this.status = 'playing';

    if (this.driver) {
      const intervalMs = Math.round(1000 / Math.max(0.2, this.playbackSpeed));
      this.driver.play(intervalMs);
    }
    this.emit();
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.active && this.cutoffTime !== null) {
      this.status = this.remainingBars <= 0 ? 'ended' : 'paused';
    }

    if (this.driver) {
      this.driver.pause();
    }
    this.emit();
  }

  public togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  private syncStateFromDriver(isStepBack = false): void {
    const state = this.driver?.getState();
    if (!state) return;
    this.cursorTime = state.cursorTime;
    this.remainingBars = Math.max(0, state.remaining);
    if (this.remainingBars > this.totalReplayBars) {
      this.totalReplayBars = this.remainingBars;
    }
    if (!isStepBack && this.remainingBars <= 0) {
      this.status = 'ended';
      this.isPlaying = false;
    } else if (isStepBack && this.status === 'ended' && this.remainingBars > 0) {
      this.status = 'paused';
    }
  }

  public step(count = 1): void {
    const steps = Math.max(1, Math.floor(count));
    if (this.driver) {
      void Promise.resolve(this.driver.step(steps)).then(() => {
        this.syncStateFromDriver(false);
        this.emit();
      });
      this.syncStateFromDriver(false);
    }
    this.emit();
  }

  public stepBack(count = 1): void {
    const steps = Math.max(1, Math.floor(count));
    if (this.isPlaying) {
      this.pause();
    }
    if (this.driver) {
      void Promise.resolve(this.driver.stepBack(steps)).then(() => {
        this.syncStateFromDriver(true);
        this.emit();
      });
      this.syncStateFromDriver(true);
    }
    this.emit();
  }

  public setSpeed(speed: number): void {
    this.playbackSpeed = speed;
    if (this.isPlaying && this.driver) {
      const intervalMs = Math.round(1000 / Math.max(0.2, this.playbackSpeed));
      this.driver.play(intervalMs);
    }
    this.emit();
  }

  public async rewind(): Promise<boolean> {
    this.pause();
    if (this.cutoffTime !== null) {
      return this.setCutoff(this.cutoffTime);
    }
    if (this.bounds) {
      return this.setCutoff(this.bounds.first);
    }
    return false;
  }

  public subscribe(listener: ReplayListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): ReplaySnapshot {
    const currentStepIndex = Math.max(0, this.totalReplayBars - this.remainingBars);
    return {
      active: this.active,
      status: this.status,
      isPlaying: this.isPlaying,
      isSelectingBar: this.isSelectingBar,
      playbackSpeed: this.playbackSpeed,
      cutoffTime: this.cutoffTime,
      cursorTime: this.cursorTime,
      remainingBars: this.remainingBars,
      totalReplayBars: this.totalReplayBars,
      currentStepIndex,
      bounds: this.bounds ? { ...this.bounds } : null,
      errorMessage: this.errorMessage,
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch (err) {
        console.warn('[ReplaySession] Error saat memanggil subscriber:', err);
      }
    }
  }
}

export const replaySession = new ReplaySession();

export type {
  IReplaySession,
  ReplayBounds,
  ReplayDriver,
  ReplayDriverState,
  ReplayListener,
  ReplaySnapshot,
  ReplayStatus,
} from './types';
export { MockReplayDriver } from './mockDriver';
