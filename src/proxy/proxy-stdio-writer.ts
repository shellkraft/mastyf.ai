/**
 * Serialized newline-delimited writes to process.stdout (stdio MCP transport).
 */
export class StdioLineWriter {
  private tail: Promise<void> = Promise.resolve();
  private readonly writeFn: (line: string) => boolean;

  constructor(writeFn: (line: string) => boolean = (line) => process.stdout.write(line)) {
    this.writeFn = writeFn;
  }

  writeLine(payload: string): void {
    const line = payload.endsWith('\n') ? payload : `${payload}\n`;
    this.tail = this.tail.then(
      () => {
        this.writeFn(line);
      },
      () => {
        this.writeFn(line);
      },
    );
  }

  /** Flush queued writes (for tests). */
  async drain(): Promise<void> {
    await this.tail;
  }
}
