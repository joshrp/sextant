import type { GraphCoreData, GraphImportData } from "~/context/store";
import type { ZoneModifiers } from "~/context/zoneModifiers";

/**
 * Factory data for export selection
 */
export interface ExportableFactory {
  id: string;
  zoneId: string;
  zoneName: string;
  zoneIcon?: string;
  name: string;
  icon?: string;
  nodeCount: number;
  edgeCount: number;
  goalCount: number;
  /** The actual factory data for export */
  data: GraphCoreData;
}

/**
 * Zone with its factories for display
 */
export interface ExportableZone {
  id: string;
  name: string;
  icon?: string;
  factories: ExportableFactory[];
  /** Modifiers for this zone — absent when all values are default */
  modifiers?: ZoneModifiers;
}

/**
 * Bulk import configuration for a single factory
 */
export interface BulkImportItem {
  data: GraphImportData;
  /** Target zone ID - empty string if creating new zone */
  targetZoneId: string;
  /** New zone name if creating a new zone */
  newZoneName?: string;
  /** Zone modifiers to apply after import (from export envelope) */
  importModifiers?: ZoneModifiers;
}
