import type { PlatformAdapter } from "./contracts.js";

export function createAdapterRegistry(
  adapters: PlatformAdapter[]
): Map<string, PlatformAdapter> {
  const registry = new Map<string, PlatformAdapter>();
  for (const adapter of adapters) {
    if (registry.has(adapter.platform)) {
      throw new Error(
        `Duplicate adapter registered for platform: ${adapter.platform}`
      );
    }
    registry.set(adapter.platform, adapter);
  }
  return registry;
}
