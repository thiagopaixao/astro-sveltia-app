/**
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest';

describe('Import test', () => {
  it('should import Windows adapter', async () => {
    const adapter = await import('../../../../src/main/adapters/WindowsPlatformAdapter.js');
    expect(adapter).toBeDefined();
    expect(adapter.WindowsPlatformAdapter).toBeDefined();
  });

  it('should import Unix adapter', async () => {
    const adapter = await import('../../../../src/main/adapters/UnixPlatformAdapter.js');
    expect(adapter).toBeDefined();
    expect(adapter.UnixPlatformAdapter).toBeDefined();
  });
});