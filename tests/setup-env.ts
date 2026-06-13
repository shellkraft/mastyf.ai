import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

if (!process.env.MASTYFF_AI_DB_PATH) {
  const dir = mkdtempSync(join(tmpdir(), 'mastyff-ai-vitest-'));
  process.env.MASTYFF_AI_DB_PATH = join(dir, 'history.db');
}

/** Unlock Pro features in unit tests (license tests clear this explicitly). */
if (process.env.MASTYFF_AI_CI_BYPASS_LICENSE !== 'false') {
  process.env.MASTYFF_AI_CI_BYPASS_LICENSE = 'true';
}
