/**
 * Shared agentic container reference for dashboard API and proxy hooks.
 */
import type { Container } from '../container.js';
import { Logger } from './logger.js';

let _agenticContainer: Container | null = null;
let _initPromise: Promise<Container | null> | null = null;

export function setAgenticContainer(container: Container | null): void {
  _agenticContainer = container;
  if (container) _initPromise = null;
}

export function getAgenticContainer(): Container | null {
  return _agenticContainer;
}

/** Lazily create agentic services when dashboard is used without a full proxy boot. */
export async function ensureAgenticContainer(): Promise<Container | null> {
  if (_agenticContainer) return _agenticContainer;
  if (process.env.MASTYFF_AI_AGENTIC_ENABLED === 'false') return null;
  if (!_initPromise) {
    _initPromise = (async () => {
      try {
        const { createContainer } = await import('../container.js');
        const dbPath = process.env.MASTYFF_AI_DB_PATH;
        const container = await createContainer(dbPath);
        _agenticContainer = container;
        Logger.info('[agentic] Container initialized for dashboard API');
        return container;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        Logger.warn(`[agentic] Failed to initialize container: ${msg}`);
        return null;
      } finally {
        _initPromise = null;
      }
    })();
  }
  return _initPromise;
}

/** Default: enabled when container is set. Set MASTYFF_AI_AGENTIC_ENABLED=false to disable hooks. */
export function isAgenticEnabled(): boolean {
  if (process.env.MASTYFF_AI_AGENTIC_ENABLED === 'false') return false;
  return _agenticContainer != null;
}

export function isAgenticDemoMode(): boolean {
  return process.env.MASTYFF_AI_AGENTIC_DEMO_MODE === 'true';
}
