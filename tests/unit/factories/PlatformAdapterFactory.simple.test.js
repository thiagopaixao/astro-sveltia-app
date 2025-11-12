/**
 * @vitest-environment node
 */

/**
 * Test suite for PlatformAdapterFactory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('PlatformAdapterFactory basic test', () => {
  it('should import the factory', async () => {
    const { PlatformAdapterFactory } = await import('../../../../src/main/factories/PlatformAdapterFactory.js');
    expect(PlatformAdapterFactory).toBeDefined();
  });
});