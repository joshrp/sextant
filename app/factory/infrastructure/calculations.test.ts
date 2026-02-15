/**
 * Unit tests for infrastructure calculation utilities
 */
import { describe, expect, it } from 'vitest';
import {
  calculateElectricity,
  calculateWorkers,
  calculateMaintenance,
  getMaintenanceTier,
  calculateComputing,
  calculateFootprint,
  calculateInfrastructure,
  calculateElectricityNet,
  calculateComputingNet,
  calculateInfrastructureNet,
} from './calculations';
import type { Machine, ProductId } from '../graph/loadJsonData';

// Helper to create a test machine with default values
function createTestMachine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: 'TestMachine',
    name: 'Test Machine',
    category_id: 'TestCategory',
    workers: 0,
    workers_generated: 0,
    electricity_consumed: 0,
    electricity_generated: 0,
    computing_consumed: 0,
    computing_generated: 0,
    storage_capacity: 0,
    unity_cost: 0,
    research_speed: 0,
    isFarm: false,
    recipes: [],
    icon: 'test.png',
    buildCosts: [],
    ...overrides,
  } as Machine;
}

describe('Infrastructure Calculations', () => {
  describe('calculateElectricity', () => {
    it('calculates electricity consumption correctly', () => {
      const machine = createTestMachine({ electricity_consumed: 100 });
      expect(calculateElectricity(machine, 2.5)).toBe(250);
    });

    it('returns 0 when no electricity is consumed', () => {
      const machine = createTestMachine({ electricity_consumed: 0 });
      expect(calculateElectricity(machine, 5)).toBe(0);
    });

    it('handles fractional run counts', () => {
      const machine = createTestMachine({ electricity_consumed: 50 });
      expect(calculateElectricity(machine, 0.5)).toBe(25);
    });
  });

  describe('calculateWorkers', () => {
    it('calculates workers with ceiling', () => {
      const machine = createTestMachine({ workers: 10 });
      expect(calculateWorkers(machine, 2.1)).toBe(30); // ceil(2.1) = 3, 3 * 10 = 30
    });

    it('returns 0 when no workers needed', () => {
      const machine = createTestMachine({ workers: 0 });
      expect(calculateWorkers(machine, 5)).toBe(0);
    });

    it('handles exact integer run counts', () => {
      const machine = createTestMachine({ workers: 5 });
      expect(calculateWorkers(machine, 3)).toBe(15);
    });
  });

  describe('calculateMaintenance', () => {
    it('calculates maintenance consumption correctly', () => {
      const machine = createTestMachine({
        maintenance_cost: {
          id: 'Product_Virtual_MaintenanceT1' as ProductId,
          quantity: 20,
        },
      });
      expect(calculateMaintenance(machine, 2.5)).toBe(50);
    });

    it('returns 0 when no maintenance cost', () => {
      const machine = createTestMachine();
      expect(calculateMaintenance(machine, 5)).toBe(0);
    });
  });

  describe('getMaintenanceTier', () => {
    it('returns tier 1 for MaintenanceT1', () => {
      const machine = createTestMachine({
        maintenance_cost: {
          id: 'Product_Virtual_MaintenanceT1' as ProductId,
          quantity: 10,
        },
      });
      expect(getMaintenanceTier(machine)).toBe(1);
    });

    it('returns tier 2 for MaintenanceT2', () => {
      const machine = createTestMachine({
        maintenance_cost: {
          id: 'Product_Virtual_MaintenanceT2' as ProductId,
          quantity: 10,
        },
      });
      expect(getMaintenanceTier(machine)).toBe(2);
    });

    it('returns tier 3 for MaintenanceT3', () => {
      const machine = createTestMachine({
        maintenance_cost: {
          id: 'Product_Virtual_MaintenanceT3' as ProductId,
          quantity: 10,
        },
      });
      expect(getMaintenanceTier(machine)).toBe(3);
    });

    it('returns null when no maintenance cost', () => {
      const machine = createTestMachine();
      expect(getMaintenanceTier(machine)).toBe(null);
    });
  });

  describe('calculateComputing', () => {
    it('calculates computing consumption correctly', () => {
      const machine = createTestMachine({ computing_consumed: 100 });
      expect(calculateComputing(machine, 2.5)).toBe(250);
    });

    it('returns 0 when no computing is consumed', () => {
      const machine = createTestMachine({ computing_consumed: 0 });
      expect(calculateComputing(machine, 5)).toBe(0);
    });
  });

  describe('calculateFootprint', () => {
    it('calculates footprint with ceiling', () => {
      const machine = createTestMachine({ footprint: [10, 5] });
      expect(calculateFootprint(machine, 2.1)).toBe(150); // ceil(2.1) = 3, 3 * 50 = 150
    });

    it('returns 0 when no footprint', () => {
      const machine = createTestMachine();
      expect(calculateFootprint(machine, 5)).toBe(0);
    });

    it('handles exact integer run counts', () => {
      const machine = createTestMachine({ footprint: [4, 4] });
      expect(calculateFootprint(machine, 3)).toBe(48); // 3 * 16 = 48
    });
  });

  describe('calculateInfrastructure', () => {
    const machine = createTestMachine({
      electricity_consumed: 100,
      workers: 5,
      computing_consumed: 50,
      footprint: [10, 10],
      maintenance_cost: {
        id: 'Product_Virtual_MaintenanceT2' as ProductId,
        quantity: 20,
      },
    });

    it('calculates electricity', () => {
      expect(calculateInfrastructure(machine, 2, 'electricity')).toBe(200);
    });

    it('calculates workers', () => {
      expect(calculateInfrastructure(machine, 2.5, 'workers')).toBe(15); // ceil(2.5) * 5
    });

    it('calculates computing', () => {
      expect(calculateInfrastructure(machine, 2, 'computing')).toBe(100);
    });

    it('calculates footprint', () => {
      expect(calculateInfrastructure(machine, 2.5, 'footprint')).toBe(300); // ceil(2.5) * 100
    });

    it('calculates correct maintenance tier', () => {
      expect(calculateInfrastructure(machine, 2, 'maintenance_1')).toBe(0);
      expect(calculateInfrastructure(machine, 2, 'maintenance_2')).toBe(40);
      expect(calculateInfrastructure(machine, 2, 'maintenance_3')).toBe(0);
    });
  });

  describe('calculateElectricityNet', () => {
    it('calculates net electricity for a generator (only generation)', () => {
      const generator = createTestMachine({
        electricity_consumed: 0,
        electricity_generated: 2000,
      });
      
      const result = calculateElectricityNet(generator, 1);
      
      expect(result.consumed).toBe(0);
      expect(result.generated).toBe(2000);
      expect(result.net).toBe(-2000); // Negative = surplus
    });

    it('calculates net electricity for a consumer (only consumption)', () => {
      const consumer = createTestMachine({
        electricity_consumed: 100,
        electricity_generated: 0,
      });
      
      const result = calculateElectricityNet(consumer, 1);
      
      expect(result.consumed).toBe(100);
      expect(result.generated).toBe(0);
      expect(result.net).toBe(100); // Positive = deficit
    });

    it('handles machines with both consumption and generation', () => {
      const hybrid = createTestMachine({
        electricity_consumed: 500,
        electricity_generated: 200,
      });
      
      const result = calculateElectricityNet(hybrid, 1);
      
      expect(result.consumed).toBe(500);
      expect(result.generated).toBe(200);
      expect(result.net).toBe(300); // Net consumption
    });

    it('scales with runCount', () => {
      const generator = createTestMachine({
        electricity_consumed: 0,
        electricity_generated: 2000,
      });
      
      const result = calculateElectricityNet(generator, 2.5);
      
      expect(result.consumed).toBe(0);
      expect(result.generated).toBe(5000);
      expect(result.net).toBe(-5000);
    });
  });

  describe('calculateComputingNet', () => {
    it('calculates net computing for a server rack (only generation)', () => {
      const serverRack = createTestMachine({
        computing_consumed: 0,
        computing_generated: 4,
      });
      
      const result = calculateComputingNet(serverRack, 1);
      
      expect(result.consumed).toBe(0);
      expect(result.generated).toBe(4);
      expect(result.net).toBe(-4); // Negative = surplus
    });

    it('calculates net computing for a consumer (only consumption)', () => {
      const consumer = createTestMachine({
        computing_consumed: 2,
        computing_generated: 0,
      });
      
      const result = calculateComputingNet(consumer, 1);
      
      expect(result.consumed).toBe(2);
      expect(result.generated).toBe(0);
      expect(result.net).toBe(2); // Positive = deficit
    });

    it('scales with runCount', () => {
      const serverRack = createTestMachine({
        computing_consumed: 0,
        computing_generated: 4,
      });
      
      const result = calculateComputingNet(serverRack, 3);
      
      expect(result.consumed).toBe(0);
      expect(result.generated).toBe(12);
      expect(result.net).toBe(-12);
    });
  });

  describe('calculateInfrastructureNet', () => {
    it('dispatches to calculateElectricityNet for electricity', () => {
      const generator = createTestMachine({
        electricity_consumed: 0,
        electricity_generated: 2000,
      });
      
      const result = calculateInfrastructureNet(generator, 1, 'electricity');
      
      expect(result.consumed).toBe(0);
      expect(result.generated).toBe(2000);
      expect(result.net).toBe(-2000);
    });

    it('dispatches to calculateComputingNet for computing', () => {
      const serverRack = createTestMachine({
        computing_consumed: 0,
        computing_generated: 4,
      });
      
      const result = calculateInfrastructureNet(serverRack, 1, 'computing');
      
      expect(result.consumed).toBe(0);
      expect(result.generated).toBe(4);
      expect(result.net).toBe(-4);
    });

    it('returns zero generation for workers', () => {
      const machine = createTestMachine({
        workers: 10,
      });
      
      const result = calculateInfrastructureNet(machine, 1, 'workers');
      
      expect(result.consumed).toBe(10);
      expect(result.generated).toBe(0);
      expect(result.net).toBe(10);
    });

    it('returns zero generation for maintenance', () => {
      const machine = createTestMachine({
        maintenance_cost: {
          id: 'Product_Virtual_MaintenanceT1' as ProductId,
          quantity: 5,
        },
      });
      
      const result = calculateInfrastructureNet(machine, 1, 'maintenance_1');
      
      expect(result.consumed).toBe(5);
      expect(result.generated).toBe(0);
      expect(result.net).toBe(5);
    });

    it('returns zero generation for footprint', () => {
      const machine = createTestMachine({
        footprint: [4, 6],
      });
      
      const result = calculateInfrastructureNet(machine, 1, 'footprint');
      
      expect(result.consumed).toBe(24);
      expect(result.generated).toBe(0);
      expect(result.net).toBe(24);
    });
  });

  describe('backward compatibility', () => {
    it('calculateElectricity returns only consumption (not net)', () => {
      const machine = createTestMachine({
        electricity_consumed: 100,
        electricity_generated: 2000,
      });
      
      const result = calculateElectricity(machine, 1);
      
      expect(result).toBe(100); // Only consumption, not net
    });

    it('calculateComputing returns only consumption (not net)', () => {
      const machine = createTestMachine({
        computing_consumed: 2,
        computing_generated: 4,
      });
      
      const result = calculateComputing(machine, 1);
      
      expect(result).toBe(2); // Only consumption, not net
    });
  });
});
