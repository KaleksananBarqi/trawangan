import { test } from 'node:test';
import assert from 'node:assert';
import { updateService } from '../src/lib/services/updateService.js';

test('UpdateService Performance Benchmark', async () => {
  // Mock global fetch to measure calls and simulate network latency
  let fetchCount = 0;
  const originalFetch = global.fetch;

  global.fetch = async (url: any, options: any) => {
    fetchCount++;
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));
    return {
      ok: true,
      json: async () => ({
        tag_name: 'v1.0.0',
        assets: [],
        name: 'Release v1.0.0',
        body: 'Notes',
        html_url: 'http',
        published_at: new Date().toISOString()
      }),
      status: 200
    } as any;
  };

  try {
    const startTime = performance.now();

    // Call 10 times
    for (let i = 0; i < 10; i++) {
      await updateService.checkForUpdates(true);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`Fetch Count: ${fetchCount}`);
    console.log(`Total Time: ${totalTime.toFixed(2)}ms`);

  } finally {
    global.fetch = originalFetch;
  }
});
