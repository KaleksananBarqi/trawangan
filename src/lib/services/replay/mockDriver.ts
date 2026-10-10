// Mock Driver Replay untuk Unit Test Headless Tanpa WebGL / Canvas DOM
import type { ReplayDriver, ReplayBounds } from './types';

export class MockReplayDriver implements ReplayDriver {
  private timeline: number[] = [];
  private currentIndex = -1;
  private isPlaying = false;
  private isSelectingVisual = false;
  private timer: any = null;

  public onStateChanged?: () => void;

  constructor(candleTimestamps: number[] = []) {
    if (candleTimestamps.length > 0) {
      this.timeline = [...candleTimestamps].sort((a, b) => a - b);
    } else {
      // Default 100 candle per 1 menit
      const now = 1700000000000;
      for (let i = 0; i < 100; i++) {
        this.timeline.push(now + i * 60000);
      }
    }
  }

  public getBounds(): ReplayBounds | null {
    if (this.timeline.length === 0) return null;
    return {
      first: this.timeline[0],
      last: this.timeline[this.timeline.length - 1],
    };
  }

  public async start(targetTime: number): Promise<boolean> {
    const idx = this.timeline.findIndex((t) => t >= targetTime);
    if (idx === -1) {
      this.currentIndex = Math.max(0, this.timeline.length - 2);
    } else {
      this.currentIndex = Math.min(idx, this.timeline.length - 2);
    }
    this.isPlaying = false;
    this.isSelectingVisual = false;
    this.onStateChanged?.();
    return true;
  }

  public play(intervalMs: number): void {
    if (this.currentIndex >= this.timeline.length - 1) return;
    this.isPlaying = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.step();
      if (this.currentIndex >= this.timeline.length - 1) {
        this.pause();
      }
    }, intervalMs);
    this.onStateChanged?.();
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.onStateChanged?.();
  }

  public step(): void {
    if (this.currentIndex < this.timeline.length - 1) {
      this.currentIndex++;
      this.onStateChanged?.();
    }
  }

  public stop(): void {
    this.pause();
    this.currentIndex = -1;
    this.isSelectingVisual = false;
    this.onStateChanged?.();
  }

  public getState() {
    if (this.currentIndex === -1) {
      return {
        active: false,
        playing: false,
        cursorTime: null,
        remaining: 0,
      };
    }
    const remaining = Math.max(0, this.timeline.length - 1 - this.currentIndex);
    return {
      active: true,
      playing: this.isPlaying,
      cursorTime: this.timeline[this.currentIndex],
      remaining,
    };
  }

  public enableCutoffVisual(): void {
    this.isSelectingVisual = true;
  }

  public cancelCutoffVisual(): void {
    this.isSelectingVisual = false;
  }

  public isVisualActive(): boolean {
    return this.isSelectingVisual;
  }
}
