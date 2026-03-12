import { Filter, Droplets, Package, Wrench, Layers } from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  home_filters: Filter,
  ro: Droplets,
  regular: Filter,
  spare_parts: Package,
  desalination: Droplets,
  default: Package,
  filter: Filter,
  droplets: Droplets,
  package: Package,
  wrench: Wrench,
  layers: Layers,
};

export function getCategoryIcon(iconKey: string | null | undefined) {
  if (!iconKey) return Package;
  const key = (iconKey || '').toLowerCase().replace(/\s+/g, '_');
  return ICON_MAP[key] || (key.includes('drop') || key.includes('ro') ? Droplets : key.includes('package') || key.includes('spare') ? Package : Filter);
}
