export interface TelemetryData {
  fps: number;
  latencyMs: number | null;
  memoryMb: number;
  jsHeapMb: number | null;
  nativeProcessMb: number | null;
  packetDrops: number;
  providerName: string;
  isOnline: boolean;
}
