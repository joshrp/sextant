/**
 * Infrastructure calculation utilities
 * 
 * These functions calculate infrastructure consumption for machines in the factory.
 * Extracted from RecipeNodeView for reusability and testability.
 */

import type { Machine } from '../graph/loadJsonData';

/**
 * Infrastructure types that can be calculated
 */
export type InfrastructureType = 
  | 'electricity' 
  | 'workers' 
  | 'maintenance_1' 
  | 'maintenance_2' 
  | 'maintenance_3' 
  | 'computing' 
  | 'footprint';

/**
 * Net infrastructure value with consumed, generated, and net amounts
 */
export interface NetInfrastructure {
  consumed: number;
  generated: number;
  net: number;
}

/**
 * Calculate electricity consumption for a machine
 * @param machine - The machine to calculate for
 * @param runCount - Number of times the machine runs
 * @returns Electricity consumed in kW
 */
export function calculateElectricity(machine: Machine, runCount: number): number {
  return machine.electricity_consumed * runCount;
}

/**
 * Calculate workers needed for a machine
 * Workers are consumed per building (integer), not per run count
 * @param machine - The machine to calculate for
 * @param runCount - Number of times the machine runs (will be ceiled)
 * @returns Number of workers needed
 */
export function calculateWorkers(machine: Machine, runCount: number): number {
  return machine.workers * Math.ceil(runCount);
}

/**
 * Calculate maintenance consumption for a machine
 * @param machine - The machine to calculate for
 * @param runCount - Number of times the machine runs
 * @returns Maintenance consumed
 */
export function calculateMaintenance(machine: Machine, runCount: number): number {
  return (machine.maintenance_cost?.quantity || 0) * runCount;
}

/**
 * Get the maintenance tier for a machine
 * @param machine - The machine to check
 * @returns The maintenance tier (1, 2, or 3), or null if no maintenance
 */
export function getMaintenanceTier(machine: Machine): 1 | 2 | 3 | null {
  const maintenanceId = machine.maintenance_cost?.id;
  if (!maintenanceId) return null;
  
  // Compare as strings since ProductId is a string type
  const idStr = maintenanceId as string;
  if (idStr === 'Product_Virtual_MaintenanceT1') return 1;
  if (idStr === 'Product_Virtual_MaintenanceT2') return 2;
  if (idStr === 'Product_Virtual_MaintenanceT3') return 3;
  
  return null;
}

/**
 * Calculate computing consumption for a machine
 * @param machine - The machine to calculate for
 * @param runCount - Number of times the machine runs
 * @returns Computing consumed in TFlops
 */
export function calculateComputing(machine: Machine, runCount: number): number {
  return machine.computing_consumed * runCount;
}

/**
 * Calculate footprint (tile area) for a machine
 * Footprint is per building (integer), not per run count
 * @param machine - The machine to calculate for
 * @param runCount - Number of times the machine runs (will be ceiled)
 * @returns Footprint in tiles
 */
export function calculateFootprint(machine: Machine, runCount: number): number {
  const area = machine.footprint?.reduce((a, i) => a * i, 1) || 0;
  return area * Math.ceil(runCount);
}

/**
 * Calculate net electricity for a machine (consumed - generated)
 * @param machine - The machine to calculate for
 * @param runCount - Number of times the machine runs
 * @returns Net electricity with consumed, generated, and net values
 */
export function calculateElectricityNet(machine: Machine, runCount: number): NetInfrastructure {
  const consumed = machine.electricity_consumed * runCount;
  const generated = machine.electricity_generated * runCount;
  return {
    consumed,
    generated,
    net: consumed - generated,
  };
}

/**
 * Calculate net computing for a machine (consumed - generated)
 * @param machine - The machine to calculate for
 * @param runCount - Number of times the machine runs
 * @returns Net computing with consumed, generated, and net values
 */
export function calculateComputingNet(machine: Machine, runCount: number): NetInfrastructure {
  const consumed = machine.computing_consumed * runCount;
  const generated = machine.computing_generated * runCount;
  return {
    consumed,
    generated,
    net: consumed - generated,
  };
}

/**
 * Calculate net workers for a machine (consumed - generated)
 * Workers are consumed per building (integer), not per run count
 * @param machine - The machine to calculate for
 * @param runCount - Number of times the machine runs (will be ceiled)
 * @returns Net workers with consumed, generated, and net values
 */
export function calculateWorkersNet(machine: Machine, runCount: number): NetInfrastructure {
  const consumed = machine.workers * Math.ceil(runCount);
  const generated = machine.workers_generated * Math.ceil(runCount);
  return {
    consumed,
    generated,
    net: consumed - generated,
  };
}

/**
 * Calculate net maintenance for a machine (consumed - generated)
 * @param machine - The machine to calculate for
 * @param runCount - Number of times the machine runs
 * @param type - The maintenance tier type
 * @returns Net maintenance with consumed, generated, and net values
 */
export function calculateMaintenanceNet(machine: Machine, runCount: number, type: 'maintenance_1' | 'maintenance_2' | 'maintenance_3'): NetInfrastructure {
  const tier = getMaintenanceTier(machine);
  const tierNum = parseInt(type.split('_')[1]);
  const consumed = tier === tierNum ? calculateMaintenance(machine, runCount) : 0;
  
  // Check if machine generates this tier of maintenance
  let generated = 0;
  if (machine.maintenance_generated) {
    const genTier = getMaintenanceTier({ ...machine, maintenance_cost: machine.maintenance_generated } as Machine);
    if (genTier === tierNum) {
      generated = machine.maintenance_generated.quantity * runCount;
    }
  }
  
  return {
    consumed,
    generated,
    net: consumed - generated,
  };
}

/**
 * Calculate net infrastructure for a specific type
 * @param machine - The machine to calculate for
 * @param runCount - Number of times the machine runs
 * @param type - The infrastructure type to calculate
 * @returns Net infrastructure with consumed, generated, and net values
 */
export function calculateInfrastructureNet(
  machine: Machine, 
  runCount: number, 
  type: InfrastructureType
): NetInfrastructure {
  switch (type) {
    case 'electricity':
      return calculateElectricityNet(machine, runCount);
    case 'computing':
      return calculateComputingNet(machine, runCount);
    case 'workers':
      return calculateWorkersNet(machine, runCount);
    case 'maintenance_1':
    case 'maintenance_2':
    case 'maintenance_3':
      return calculateMaintenanceNet(machine, runCount, type);
    case 'footprint': {
      // Footprint doesn't support generation
      const consumed = calculateInfrastructure(machine, runCount, type);
      return {
        consumed,
        generated: 0,
        net: consumed,
      };
    }
  }
}

/**
 * Calculate infrastructure consumption for a specific type
 * @param machine - The machine to calculate for
 * @param runCount - Number of times the machine runs
 * @param type - The infrastructure type to calculate
 * @returns The amount of infrastructure consumed
 */
export function calculateInfrastructure(
  machine: Machine, 
  runCount: number, 
  type: InfrastructureType
): number {
  switch (type) {
    case 'electricity':
      return calculateElectricity(machine, runCount);
    case 'workers':
      return calculateWorkers(machine, runCount);
    case 'maintenance_1':
    case 'maintenance_2':
    case 'maintenance_3': {
      const tier = getMaintenanceTier(machine);
      const tierNum = parseInt(type.split('_')[1]);
      return tier === tierNum ? calculateMaintenance(machine, runCount) : 0;
    }
    case 'computing':
      return calculateComputing(machine, runCount);
    case 'footprint':
      return calculateFootprint(machine, runCount);
  }
}
