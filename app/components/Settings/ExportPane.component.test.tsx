import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportPane from './ExportPane';
import { PlannerContext } from '~/context/PlannerContext';
import type { ExportableZone } from '~/types/bulkOperations';

// Mock data with duplicate factory names across zones
const mockExportableZones: ExportableZone[] = [
  {
    id: 'zone-1',
    name: 'Zone 1',
    factories: [
      {
        id: 'power-plant',
        zoneId: 'zone-1',
        zoneName: 'Zone 1',
        name: 'Power Plant',
        nodeCount: 5,
        edgeCount: 4,
        goalCount: 1,
        data: {
          name: 'Power Plant',
          nodes: [],
          edges: [],
          goals: [],
        },
      },
      {
        id: 'steel-factory',
        zoneId: 'zone-1',
        zoneName: 'Zone 1',
        name: 'Steel Factory',
        nodeCount: 3,
        edgeCount: 2,
        goalCount: 1,
        data: {
          name: 'Steel Factory',
          nodes: [],
          edges: [],
          goals: [],
        },
      },
    ],
  },
  {
    id: 'zone-2',
    name: 'Zone 2',
    factories: [
      {
        id: 'power-plant-2', // Different ID, simulating unique IDs but duplicate names
        zoneId: 'zone-2',
        zoneName: 'Zone 2',
        name: 'Power Plant', // Same name as in Zone 1
        nodeCount: 7,
        edgeCount: 6,
        goalCount: 2,
        data: {
          name: 'Power Plant',
          nodes: [],
          edges: [],
          goals: [],
        },
      },
    ],
  },
];

describe('ExportPane - Duplicate Factory Names Bug Fix', () => {
  const mockGetExportableData = async () => mockExportableZones;
  const mockBulkImport = async () => {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockStore = null as any;

  const renderExportPane = () => {
    return render(
      <PlannerContext.Provider
        value={{
          store: mockStore,
          bulkImport: mockBulkImport,
          getExportableData: mockGetExportableData,
          importWelcomeFactory: async () => {},
        }}
      >
        <ExportPane />
      </PlannerContext.Provider>
    );
  };

  beforeEach(() => {
    // Reset any global state if needed
  });

  afterEach(() => {
    cleanup();
  });

  it('should render zones with factories', async () => {
    renderExportPane();

    await waitFor(() => {
      expect(screen.getAllByText('Zone 1')[0]).toBeInTheDocument();
      expect(screen.getByText('Zone 2')).toBeInTheDocument();
    });
  });

  it('should not select both factories when clicking one with duplicate name', async () => {
    const user = userEvent.setup();
    renderExportPane();

    // Wait for zones to load
    await waitFor(() => {
      expect(screen.getAllByText('Zone 1')[0]).toBeInTheDocument();
    });

    // Get both "Power Plant" factories - they have different parent zones
    const zone1PowerPlant = screen.getAllByText('Power Plant')[0];
    const zone2PowerPlant = screen.getAllByText('Power Plant')[1];

    // Click Zone 1's Power Plant
    await user.click(zone1PowerPlant.closest('.cursor-pointer')!);

    // Check selection state - only Zone 1's Power Plant should be selected
    // The component should show "1 of 3 factories selected"
    await waitFor(() => {
      expect(screen.getByText(/1 of 3 factories selected/)).toBeInTheDocument();
    });

    // Verify that clicking didn't select Zone 2's Power Plant by checking the checkbox state
    const zone1Factory = zone1PowerPlant.closest('.cursor-pointer')!;
    const zone2Factory = zone2PowerPlant.closest('.cursor-pointer')!;
    
    const zone1Checkbox = zone1Factory.querySelector('.bg-blue-500');
    const zone2Checkbox = zone2Factory.querySelector('.bg-blue-500');
    
    expect(zone1Checkbox).toBeInTheDocument(); // Should be selected (blue)
    expect(zone2Checkbox).not.toBeInTheDocument(); // Should not be selected
  });

  it('should handle selecting factories from different zones independently', async () => {
    const user = userEvent.setup();
    renderExportPane();

    await waitFor(() => {
      expect(screen.getAllByText('Zone 1')[0]).toBeInTheDocument();
    });

    // Select Zone 1's Power Plant
    const zone1PowerPlant = screen.getAllByText('Power Plant')[0].closest('.cursor-pointer')!;
    await user.click(zone1PowerPlant);

    await waitFor(() => {
      expect(screen.getByText(/1 of 3 factories selected/)).toBeInTheDocument();
    });

    // Select Zone 2's Power Plant
    const zone2PowerPlant = screen.getAllByText('Power Plant')[1].closest('.cursor-pointer')!;
    await user.click(zone2PowerPlant);

    // Now should show 2 of 3 factories selected
    await waitFor(() => {
      expect(screen.getByText(/2 of 3 factories selected/)).toBeInTheDocument();
    });
  });

  it('should deselect only the clicked factory when clicked twice', async () => {
    const user = userEvent.setup();
    renderExportPane();

    await waitFor(() => {
      expect(screen.getAllByText('Zone 1')[0]).toBeInTheDocument();
    });

    const zone1PowerPlant = screen.getAllByText('Power Plant')[0].closest('.cursor-pointer')!;
    
    // Click to select
    await user.click(zone1PowerPlant);
    await waitFor(() => {
      expect(screen.getByText(/1 of 3 factories selected/)).toBeInTheDocument();
    });

    // Click again to deselect
    await user.click(zone1PowerPlant);
    await waitFor(() => {
      expect(screen.getByText(/0 of 3 factories selected/)).toBeInTheDocument();
    });
  });
});
