// Modul Deep Replay Session: Mengenkapsulasi State Machine Replay, Kontrol Playback, dan Seam Chart
import type {
  IReplaySession,
  ReplayBounds,
  ReplayDriver,
  ReplayListener,
  ReplaySnapshot,
  ReplayStatus,
} from './types';

export class ReplaySession implements IReplaySession {
  private active = false;
  private status: ReplayStatus = 'idle';
  private isPlaying = false;
  private isSelectingBar = false;
  private playbackSpeed = 1;
  private cutoffTime: number | null = null;
  private cursorTime: number | null = null;
  private remainingBars = 0;
  private bounds: ReplayBounds | null = null;

  private driver: ReplayDriver | null = null;
  private listeners = new Set<ReplayListener>();

  // ─── Driver Binding ───

  public bindDriver(driver: ReplayDriver | null): void {
    this.driver = driver;
    if (this.driver) {
      const b = this.driver.getBounds();
      if (b) {
        this.bounds = b;
      }
      // Jika session sedang dalam pemilihan bar saat driver baru terpasang
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
  }): void {
    if (state.active !== undefined) this.active = state.active;
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
      this.remainingBars = state.remaining;
      if (this.remainingBars <= 0 && this.status === 'playing') {
        this.status = 'ended';
        this.isPlaying = false;
      }
    }
    if (state.bounds !== undefined) this.bounds = state.bounds;

    this.emit();
  }

  // ─── Lifecycle & Mode Controls ───

  public open(): void {
    this.active = true;
    this.isPlaying = false;
    this.isSelectingBar = true;
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

    if (this.driver) {
      this.driver.stop();
      this.driver.cancelCutoffVisual();
    }
    this.emit();
  }

  public enableBarSelection(): void {
    if (!this.active) this.active = true;
    this.isSelectingBar = true;
    this.status = 'selecting_cutoff';

    if (this.driver) {
      this.driver.enableCutoffVisual();
    }
    this.emit();
  }

  public cancelBarSelection(): void {
    this.isSelectingBar = false;
    if (this.cutoffTime) {
      this.status = this.isPlaying ? 'playing' : 'paused';
    } else {
      this.status = 'idle';
    }

    if (this.driver) {
      this.driver.cancelCutoffVisual();
    }
    this.emit();
  }

  public async setCutoff(timestamp: number): Promise<boolean> {
    this.isSelectingBar = false;
    this.cutoffTime = timestamp;
    this.cursorTime = timestamp;
    this.status = 'ready';

    if (this.driver) {
      this.driver.cancelCutoffVisual();
      const ok = await this.driver.start(timestamp);
      if (ok) {
        const state = this.driver.getState();
        if (state) {
          this.cursorTime = state.cursorTime ?? timestamp;
          this.remainingBars = state.remaining;
          this.isPlaying = state.playing;
        }
      }
      this.emit();
      return ok;
    }

    this.emit();
    return true;
  }

  // ─── Playback Controls ───

  public play(speed?: number): void {
    if (speed !== undefined) {
      this.playbackSpeed = speed;
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
    this.status = 'paused';

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

  public step(): void {
    if (this.driver) {
      this.driver.step();
      const state = this.driver.getState();
      if (state) {
        this.cursorTime = state.cursorTime;
        this.remainingBars = state.remaining;
        if (this.remainingBars <= 0) {
          this.status = 'ended';
          this.isPlaying = false;
        }
      }
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

  // ─── Subscription & Snapshot ───

  public subscribe(listener: ReplayListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): ReplaySnapshot {
    return {
      active: this.active,
      status: this.status,
      isPlaying: this.isPlaying,
      isSelectingBar: this.isSelectingBar,
      playbackSpeed: this.playbackSpeed,
      cutoffTime: this.cutoffTime,
      cursorTime: this.cursorTime,
      remainingBars: this.remainingBars,
      bounds: this.bounds ? { ...this.bounds } : null,
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

// Singleton Service Instance
export const replaySession = new ReplaySession();

export type { IReplaySession, ReplayBounds, ReplayDriver, ReplayListener, ReplaySnapshot, ReplayStatus } from './types';
export { MockReplayDriver } from './mockDriver';
