export interface SseFrame {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export interface SseWritable {
  write(chunk: string): boolean;
  end(): void;
  setHeader(name: string, value: string): void;
  flushHeaders?(): void;
  on(event: 'close' | 'error', listener: () => void): void;
  off(event: 'close' | 'error', listener: () => void): void;
}
