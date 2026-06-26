import { StdioLineWriter } from './proxy-stdio-writer.js';

export class JsonRpcResponseTracker {
  private readonly responded = new Set<string>();
  private readonly maxTracked: number;

  constructor(maxTracked = 10_000) {
    this.maxTracked = maxTracked;
  }

  private key(id: string | number): string {
    return String(id);
  }

  hasResponded(id: string | number): boolean {
    return this.responded.has(this.key(id));
  }

  markResponded(id: string | number): void {
    const k = this.key(id);
    if (this.responded.size >= this.maxTracked) {
      const first = this.responded.values().next().value;
      if (first !== undefined) this.responded.delete(first);
    }
    this.responded.add(k);
  }

  clearResponded(id: string | number): void {
    this.responded.delete(this.key(id));
  }

  clearAll(): void {
    this.responded.clear();
  }

  sendError(
    writer: StdioLineWriter,
    id: string | number,
    code: number,
    message: string,
    data?: Record<string, unknown>,
  ): boolean {
    if (this.hasResponded(id)) return false;
    this.markResponded(id);
    writer.writeLine(
      JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code, message, data },
      }),
    );
    return true;
  }

  sendJson(writer: StdioLineWriter, payload: Record<string, unknown>): boolean {
    const id = payload.id;
    if (id != null && (typeof id === 'string' || typeof id === 'number')) {
      if (this.hasResponded(id)) return false;
      this.markResponded(id);
    }
    writer.writeLine(JSON.stringify(payload));
    return true;
  }

  writePassthrough(writer: StdioLineWriter, line: string): void {
    writer.writeLine(line);
  }
}
