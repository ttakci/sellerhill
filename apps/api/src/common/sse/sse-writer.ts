import type { SseFrame, SseWritable } from './sse.types';

const normalize = (value: string): string => value.replace(/\r\n|\r/g, '\n');
const field = (value: string): string => normalize(value).replace(/\n/g, '');

export class SseWriter {
  private closed = false;
  private heartbeat: NodeJS.Timeout | null = null;
  private readonly closeListener = (): void => this.close();

  constructor(private readonly response: SseWritable, private readonly abortController = new AbortController()) {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();
    response.on('close', this.closeListener);
    response.on('error', this.closeListener);
  }

  get signal(): AbortSignal { return this.abortController.signal; }
  get isClosed(): boolean { return this.closed; }

  write(frame: SseFrame): boolean {
    if (this.closed) { return false; }
    const lines: string[] = [];
    if (frame.id !== undefined) { lines.push(`id: ${field(frame.id)}`); }
    if (frame.event !== undefined) { lines.push(`event: ${field(frame.event)}`); }
    if (frame.retry !== undefined) { lines.push(`retry: ${Math.max(0, Math.trunc(frame.retry))}`); }
    for (const line of normalize(frame.data).split('\n')) { lines.push(`data: ${line}`); }
    return this.response.write(`${lines.join('\n')}\n\n`);
  }

  comment(comment: string): boolean {
    if (this.closed) { return false; }
    return this.response.write(`${normalize(comment).split('\n').map((line) => `: ${line}`).join('\n')}\n\n`);
  }

  startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => this.comment('heartbeat'), intervalMs);
    this.heartbeat.unref?.();
  }

  close(): void {
    if (this.closed) { return; }
    this.closed = true;
    this.stopHeartbeat();
    this.response.off('close', this.closeListener);
    this.response.off('error', this.closeListener);
    this.abortController.abort();
    this.response.end();
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) { clearInterval(this.heartbeat); this.heartbeat = null; }
  }
}
