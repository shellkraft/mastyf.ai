/**
 * Streaming Response DLP Inspector — hooks into the proxy's streaming response
 * path (SSE, WebSocket, stdio) to scan response chunks in real-time for DLP
 * violations, blocking or redacting mid-stream.
 *
 * Operates on configurable window sizes (default 4KB) to avoid buffering
 * entire responses in memory. Applies the same DLP patterns as response-scanner.
 */
import { Logger } from '../../utils/logger.js';
import { ResponseDlpScanner } from './response-scanner.js';

export type StreamAction = 'pass' | 'redact' | 'block';

export interface StreamChunkResult {
  action: StreamAction;
  /** Redacted chunk text (if action is 'redact') */
  redactedChunk?: string;
  /** Reason for block/redact */
  reason?: string;
  /** Whether to close the stream entirely */
  terminateStream: boolean;
  /** Accumulated violations */
  violations: string[];
}

export class StreamingResponseDlpInspector {
  private scanner = new ResponseDlpScanner();
  private readonly windowSize: number;
  private readonly accumulateWindow = true;

  constructor(windowSize: number = 4096) {
    this.windowSize = windowSize;
  }

  /**
   * Inspect a single chunk of streaming response text.
   * Maintains an internal buffer to scan across chunk boundaries.
   */
  private buffer = '';
  private bytesProcessed = 0;

  inspectChunk(
    toolName: string,
    serverName: string,
    chunk: string,
    isLastChunk: boolean = false,
  ): StreamChunkResult {
    this.buffer += chunk;
    this.bytesProcessed += chunk.length;

    // Only scan when buffer exceeds window size or it's the last chunk
    if (this.buffer.length < this.windowSize && !isLastChunk) {
      return { action: 'pass', terminateStream: false, violations: [] };
    }

    // Scan the accumulated buffer
    const scanText = this.accumulateWindow ? this.buffer : chunk;
    const result = this.scanner.scan(toolName, serverName, scanText);

    if (result.block) {
      Logger.warn(`[StreamingDlp] BLOCKED: ${result.summary}`);
      this.buffer = '';
      return {
        action: 'block',
        terminateStream: true,
        reason: result.summary,
        violations: result.violations.map(v => v.finding),
      };
    }

    if (result.violated && result.redactedText) {
      Logger.info(`[StreamingDlp] Redacted ${result.violations.length} violations in stream`);
      const redactedChunk = result.redactedText.slice(-chunk.length); // Only return the new portion
      this.buffer = '';
      return {
        action: 'redact',
        redactedChunk,
        terminateStream: false,
        violations: result.violations.map(v => v.finding),
      };
    }

    // Clean — clear buffer but keep last window-size bytes for cross-boundary detection
    if (this.buffer.length > this.windowSize * 2) {
      this.buffer = this.buffer.slice(-this.windowSize);
    }

    return { action: 'pass', terminateStream: false, violations: [] };
  }

  /** Reset the internal buffer (e.g., on new stream). */
  reset(): void {
    this.buffer = '';
    this.bytesProcessed = 0;
  }

  /** Get statistics. */
  getStats(): { bytesProcessed: number; currentBufferSize: number } {
    return {
      bytesProcessed: this.bytesProcessed,
      currentBufferSize: this.buffer.length,
    };
  }
}