/**
 * Benchmark: Agentic Scheduler Overhead
 *
 * Measures the CPU/memory overhead of the agentic scheduler with N registered tasks.
 *
 * Run: pnpm tsx benchmarks/agentic-scheduler-overhead.ts
 */

import { AgenticScheduler } from '../src/agentic/scheduler.js';

async function benchmark(): Promise<void> {
  console.log('=== Agentic Scheduler Overhead Benchmark ===\n');

  const taskCounts = [0, 5, 10, 25, 50, 100];

  for (const count of taskCounts) {
    const scheduler = new AgenticScheduler();

    // Register N no-op tasks
    for (let i = 0; i < count; i++) {
      scheduler.register('task-' + i, 'Benchmark Task ' + i, '24h', async () => {});
    }

    const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
    const t0 = Date.now();

    scheduler.start();

    const startTime = Date.now() - t0;

    // Run all tasks once
    const r0 = Date.now();
    const runPromises = [];
    for (let i = 0; i < count; i++) {
      runPromises.push(scheduler.runNow('task-' + i));
    }
    await Promise.all(runPromises);
    const runAllTime = Date.now() - r0;

    const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
    const memDelta = memAfter - memBefore;
    const perTaskKb = count > 0 ? Math.round((memDelta / count) * 1024) : 0;

    await scheduler.shutdown();

    console.log('Tasks: ' + count);
    console.log('  Start time:     ' + startTime + 'ms');
    console.log('  Run-all time:   ' + runAllTime + 'ms');
    console.log('  Heap delta:     ' + memDelta.toFixed(2) + ' MB');
    console.log('  Per-task mem:   ' + perTaskKb + ' KB');
    console.log('');
  }

  console.log('Done.');
}

benchmark().catch(console.error);