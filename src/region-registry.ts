import type { RegionConfig } from './region-config';

const registry: Map<string, RegionConfig> = new Map();

export function registerRegion(config: RegionConfig): void {
  registry.set(config.id, config);
}

export function getRegion(id: string): RegionConfig | undefined {
  return registry.get(id);
}

export function getAllRegions(): RegionConfig[] {
  return Array.from(registry.values());
}

export function getDefaultRegionId(): string {
  return 'campi-flegrei';
}
