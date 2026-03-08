import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { 
  CheckIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/solid';
import { ArrowsUpDownIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

import usePlanner, { usePlannerStore } from '~/context/PlannerContext';
import { zoneIdFromName } from '~/context/utils';
import { decompressBulk, type BulkImportData } from '~/factory/importexport/importexport';
import type { GraphImportData } from '~/context/store';
import { DEFAULT_ZONE_MODIFIERS, MODIFIER_META, type ZoneModifiers } from '~/context/zoneModifiers';

/**
 * Import configuration for a single factory
 */
interface FactoryImportConfig {
  /** Original index in the import data */
  index: number;
  /** Whether to import this factory */
  selected: boolean;
  /** Factory name (can be edited) */
  name: string;
  /** Original zone name from import */
  originalZoneName: string;
  /** Current target zone name (can be changed via drag and drop) */
  targetZoneName: string;
  /** Factory data */
  data: GraphImportData;
}

/**
 * Zone import configuration
 */
interface ZoneImportConfig {
  /** Original zone name from import */
  originalName: string;
  /** Target zone name (can be edited) */
  targetName: string;
  /** Whether to create a new zone */
  createNew: boolean;
  /** Whether the zone is expanded in UI */
  expanded: boolean;
  /** Modifiers from export envelope, present only when the export included them */
  availableModifiers?: ZoneModifiers;
  /** Whether to apply availableModifiers on import */
  importModifiers: boolean;
}

/**
 * Existing zone with factory names
 */
interface ExistingZoneInfo {
  id: string;
  name: string;
  factoryNames: string[];
  modifiers?: ZoneModifiers;
}

export default function ImportPane() {
  const [importString, setImportString] = useState('');
  const [importData, setImportData] = useState<BulkImportData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Factory configurations
  const [factoryConfigs, setFactoryConfigs] = useState<FactoryImportConfig[]>([]);
  
  // Zone configurations (for multi-zone imports)
  const [zoneConfigs, setZoneConfigs] = useState<ZoneImportConfig[]>([]);

  // Single zone mode: target zone selection
  const [singleZoneTarget, setSingleZoneTarget] = useState<string>('');
  const [newZoneName, setNewZoneName] = useState<string>('');
  const [createNewZone, setCreateNewZone] = useState(false);
  // Modifier opt-in for single-zone mode
  const [singleZoneAvailableModifiers, setSingleZoneAvailableModifiers] = useState<ZoneModifiers | undefined>(undefined);
  const [singleZoneImportModifiers, setSingleZoneImportModifiers] = useState(false);

  // Drag state
  const [draggedFactoryIndex, setDraggedFactoryIndex] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);

  // Store original configs for reset functionality
  const [originalFactoryConfigs, setOriginalFactoryConfigs] = useState<FactoryImportConfig[]>([]);
  const [originalZoneConfigs, setOriginalZoneConfigs] = useState<ZoneImportConfig[]>([]);

  const planner = usePlanner();
  const zones = usePlannerStore(state => state.zones);
  const nav = useNavigate();

  // Get existing zones with their factory names
  const [existingZoneInfos, setExistingZoneInfos] = useState<ExistingZoneInfo[]>([]);

  // Load existing zone factory names
  useEffect(() => {
    async function loadExistingFactoryNames() {
      try {
        const exportableData = await planner.getExportableData();
        const infos: ExistingZoneInfo[] = exportableData.map(z => ({
          id: z.id,
          name: z.name,
          factoryNames: z.factories.map(f => f.name),
          modifiers: z.modifiers,
        }));
        setExistingZoneInfos(infos);
      } catch (err) {
        console.error('Failed to load existing factory names:', err);
      }
    }
    loadExistingFactoryNames();
  }, [planner]);

  const existingZoneNames = useMemo(() => zones.map(z => z.name), [zones]);
  const existingZones = useMemo(() => zones.map(z => ({ id: z.id, name: z.name })), [zones]);

  // Refs to access current zone data without causing re-renders
  const existingZoneNamesRef = useRef(existingZoneNames);
  const existingZonesRef = useRef(existingZones);
  const zoneConfigsRef = useRef(zoneConfigs);
  useEffect(() => {
    existingZoneNamesRef.current = existingZoneNames;
    existingZonesRef.current = existingZones;
  }, [existingZoneNames, existingZones]);
  useEffect(() => {
    zoneConfigsRef.current = zoneConfigs;
  }, [zoneConfigs]);

  // Parse import string with debouncing
  const parseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse and initialize configs
  useEffect(() => {
    // Clear previous timeout
    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current);
      parseTimeoutRef.current = null;
    }

    if (importString.length < 10) {
      setImportData(null);
      setParseError(null);
      return;
    }

    // Debounce parsing by 300ms to avoid performance issues during typing
    parseTimeoutRef.current = setTimeout(() => {
      decompressBulk(importString)
        .then(data => {
          setImportData(data);
          setParseError(null);
          
          // Initialize factory configs
          const configs: FactoryImportConfig[] = data.factories.map((f, i) => ({
            index: i,
            selected: true,
            name: f.name,
            originalZoneName: f.zoneName || '',
            targetZoneName: f.zoneName || '',
            data: f,
          }));
          setFactoryConfigs(configs);
          setOriginalFactoryConfigs(structuredClone(configs));

          // Initialize zone configs - use ref to get current values
          const currentExistingZoneNames = existingZoneNamesRef.current;
          const currentExistingZones = existingZonesRef.current;
          
          const zoneConfigsArray: ZoneImportConfig[] = [];
          data.zoneGroups.forEach((_, zoneName) => {
            const isNew = !currentExistingZoneNames.includes(zoneName);
            const availableModifiers = data.zoneModifiers?.get(zoneName);
            zoneConfigsArray.push({
              originalName: zoneName,
              targetName: zoneName,
              createNew: isNew,
              expanded: true,
              availableModifiers,
              // Default on for new zones, off for existing
              importModifiers: availableModifiers !== undefined ? isNew : false,
            });
          });
          setZoneConfigs(zoneConfigsArray);
          setOriginalZoneConfigs(structuredClone(zoneConfigsArray));

          // Set default single zone target
          if (data.isSingleZone) {
            const firstZoneName = data.factories[0]?.zoneName || '';
            const availableModifiers = data.zoneModifiers?.get(firstZoneName);
            setSingleZoneAvailableModifiers(availableModifiers);
            if (currentExistingZones.some(z => z.name === firstZoneName)) {
              setSingleZoneTarget(firstZoneName);
              setCreateNewZone(false);
              // Default off when mapping to existing zone
              setSingleZoneImportModifiers(false);
            } else if (currentExistingZones.length > 0) {
              setSingleZoneTarget(currentExistingZones[0].name);
              setCreateNewZone(false);
              setSingleZoneImportModifiers(false);
            } else {
              setCreateNewZone(true);
              setNewZoneName(firstZoneName || 'Imported Zone');
              // Default on for new zones
              setSingleZoneImportModifiers(availableModifiers !== undefined);
            }
          }
        })
        .catch(err => {
          console.error('Import parse error:', err);
          setParseError(err.message || 'Failed to parse import data');
          setImportData(null);
        });
    }, 300);

    return () => {
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
      }
    };
  }, [importString]);

  // Compute name collisions as a derived value (avoids useEffect update cycles)
  // Only checks against EXISTING factories in the target zone - not other factories in the import
  // These are warnings only, not blocking (allows creating factories with same names)
  const factoryCollisions = useMemo(() => {
    if (!importData) return new Map<number, string>();
    
    const collisions = new Map<number, string>();
    
    factoryConfigs.forEach(config => {
      if (!config.selected) return;

      // Determine target zone name (the final name the zone will have)
      let targetZoneName: string;
      if (importData.isSingleZone) {
        targetZoneName = createNewZone ? newZoneName : singleZoneTarget;
      } else {
        // For multi-zone, we need to look up the zone's targetName from zoneConfigs
        const zoneConfig = zoneConfigs.find(z => z.originalName === config.originalZoneName);
        targetZoneName = zoneConfig?.targetName || config.originalZoneName;
      }

      // Only check existing factory names in target zone (not other factories in the import)
      const existingZone = existingZoneInfos.find(z => z.name === targetZoneName);
      const existingNames = existingZone?.factoryNames || [];
      
      if (existingNames.includes(config.name)) {
        collisions.set(config.index, `Name exists in zone`);
      }
    });
    
    return collisions;
  }, [factoryConfigs, zoneConfigs, importData, createNewZone, newZoneName, singleZoneTarget, existingZoneInfos]);

  // Toggle factory selection
  const toggleFactorySelection = useCallback((index: number) => {
    setFactoryConfigs(prev =>
      prev.map(c => (c.index === index ? { ...c, selected: !c.selected } : c))
    );
  }, []);

  // Update factory name
  const updateFactoryName = useCallback((index: number, name: string) => {
    setFactoryConfigs(prev =>
      prev.map(c => (c.index === index ? { ...c, name } : c))
    );
  }, []);

  // Toggle zone selection (selects/deselects all factories in zone)
  const toggleZoneSelection = useCallback((originalZoneName: string) => {
    setFactoryConfigs(prev => {
      const factoriesInZone = prev.filter(c => c.originalZoneName === originalZoneName);
      const allSelected = factoriesInZone.every(c => c.selected);
      return prev.map(c =>
        c.originalZoneName === originalZoneName
          ? { ...c, selected: !allSelected }
          : c
      );
    });
  }, []);

  // Move factory to different zone (drag and drop)
  // The targetOriginalZoneName is the originalName of the target zone
  const moveFactoryToZone = useCallback((factoryIndex: number, targetOriginalZoneName: string) => {
    // Look up the zone's current targetName for the factory's targetZoneName
    const targetZoneConfig = zoneConfigsRef.current.find(z => z.originalName === targetOriginalZoneName);
    const finalTargetZoneName = targetZoneConfig?.targetName || targetOriginalZoneName;
    
    setFactoryConfigs(prev =>
      prev.map(c => {
        if (c.index === factoryIndex) {
          return { 
            ...c, 
            originalZoneName: targetOriginalZoneName, 
            targetZoneName: finalTargetZoneName 
          };
        }
        return c;
      })
    );
  }, []);

  // Reset to original import state
  const handleReset = useCallback(() => {
    setFactoryConfigs(structuredClone(originalFactoryConfigs));
    setZoneConfigs(structuredClone(originalZoneConfigs));
  }, [originalFactoryConfigs, originalZoneConfigs]);

  // Add a new empty zone for drag targets
  const [newZoneCounter, setNewZoneCounter] = useState(1);
  const handleAddNewZone = useCallback(() => {
    const newZoneName = `New Zone ${newZoneCounter}`;
    // Generate a unique original name that won't conflict
    const originalName = `__new_zone_${Date.now()}_${newZoneCounter}`;
    setZoneConfigs(prev => [
      ...prev,
      {
        originalName,
        targetName: newZoneName,
        createNew: true,
        expanded: true,
        importModifiers: false,
      },
    ]);
    setNewZoneCounter(c => c + 1);
  }, [newZoneCounter]);

  // Get zones with their factories for display (grouped by original zone name for stability)
  const zonesWithFactories = useMemo(() => {
    // Group factories by their ORIGINAL zone name (stable during edits)
    const zoneMap = new Map<string, FactoryImportConfig[]>();
    
    // First, add all zones from zoneConfigs (ensures empty zones are included)
    zoneConfigs.forEach(zc => {
      zoneMap.set(zc.originalName, []);
    });
    
    // Then add factories to their zones
    factoryConfigs.forEach(config => {
      // Group by original zone name to keep UI stable during zone name edits
      const zone = config.originalZoneName;
      if (!zoneMap.has(zone)) {
        zoneMap.set(zone, []);
      }
      zoneMap.get(zone)!.push(config);
    });
    
    return Array.from(zoneMap.entries()).map(([originalZoneName, factories]) => {
      const zoneConfig = zoneConfigs.find(z => z.originalName === originalZoneName) || {
        originalName: originalZoneName,
        targetName: originalZoneName,
        createNew: !existingZoneNames.includes(originalZoneName),
        expanded: true,
        availableModifiers: undefined,
        importModifiers: false,
      };
      return {
        ...zoneConfig,
        factories,
      };
    });
  }, [factoryConfigs, zoneConfigs, existingZoneNames]);

  // Check for zone name collisions (only when creating new zones)
  const zoneNameCollisions = zonesWithFactories.filter(
    z => z.createNew && existingZoneNames.includes(z.targetName) && z.factories.some(f => f.selected)
  );

  // Handle import
  const handleImport = useCallback(async () => {
    if (!importData) return;

    setIsImporting(true);

    try {
      const selectedFactories = factoryConfigs.filter(c => c.selected);
      
      if (importData.isSingleZone) {
        // Single zone mode
        const targetZoneId = createNewZone
          ? '' // Will be created
          : existingZones.find(z => z.name === singleZoneTarget)?.id || '';

        const modifiersToApply =
          singleZoneImportModifiers && singleZoneAvailableModifiers
            ? singleZoneAvailableModifiers
            : undefined;

        await planner.bulkImport(
          selectedFactories.map(c => ({
            data: { ...c.data, name: c.name },
            targetZoneId,
            newZoneName: createNewZone ? newZoneName : undefined,
            importModifiers: modifiersToApply,
          }))
        );
      } else {
        // Multi-zone mode - group by original zone name
        const importItems: Array<{
          data: GraphImportData;
          targetZoneId: string;
          newZoneName?: string;
          importModifiers?: ZoneModifiers;
        }> = [];

        for (const config of selectedFactories) {
          // Find zone config by original zone name
          const zoneConfig = zonesWithFactories.find(
            z => z.originalName === config.originalZoneName
          );
          
          if (!zoneConfig) continue;

          // Check if target zone exists by the RENAMED target name
          const existingZone = existingZones.find(
            z => z.name === zoneConfig.targetName
          );

          const modifiersToApply =
            zoneConfig.importModifiers && zoneConfig.availableModifiers
              ? zoneConfig.availableModifiers
              : undefined;

          importItems.push({
            data: { ...config.data, name: config.name },
            targetZoneId: existingZone?.id || '',
            newZoneName: zoneConfig.createNew ? zoneConfig.targetName : undefined,
            importModifiers: modifiersToApply,
          });
        }

        await planner.bulkImport(importItems);
      }

      // Navigate to the first imported factory's zone
      const firstSelected = selectedFactories[0];
      if (firstSelected) {
        let targetZoneId: string;
        if (importData.isSingleZone) {
          targetZoneId = createNewZone
            ? zoneIdFromName(newZoneName)
            : existingZones.find(z => z.name === singleZoneTarget)?.id || '';
        } else {
          const zoneConfig = zonesWithFactories.find(z => z.originalName === firstSelected.originalZoneName);
          const existingZone = existingZones.find(z => z.name === zoneConfig?.targetName);
          targetZoneId = existingZone?.id || zoneIdFromName(zoneConfig?.targetName || firstSelected.originalZoneName);
        }
        nav(`/zones/${targetZoneId}`);
      }
    } catch (err) {
      console.error('Import failed:', err);
      setParseError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  }, [
    importData,
    factoryConfigs,
    zonesWithFactories,
    createNewZone,
    newZoneName,
    singleZoneTarget,
    existingZones,
    planner,
    nav,
  ]);

  const selectedCount = factoryConfigs.filter(c => c.selected).length;
  // Factory name collisions are warnings only - don't block import
  const canImport =
    importData &&
    selectedCount > 0 &&
    zoneNameCollisions.length === 0 &&
    (importData.isSingleZone ? (createNewZone ? newZoneName.trim() : singleZoneTarget) : true);

  // Handle drag start - use custom drag image and track position
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedFactoryIndex(index);
    
    // Create a custom drag image
    const dragPreview = document.createElement('div');
    dragPreview.className = 'bg-gray-800 text-white px-3 py-2 rounded shadow-lg text-sm';
    dragPreview.textContent = factoryConfigs[index]?.name || 'Factory';
    dragPreview.style.position = 'absolute';
    dragPreview.style.top = '-1000px';
    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 0, 0);
    
    // Clean up after a short delay
    setTimeout(() => {
      try {
        if (dragPreview.parentNode) {
          document.body.removeChild(dragPreview);
        }
      } catch {
        // Element already removed
      }
    }, 0);
  };

  // Handle drag
  const handleDrag = (e: React.DragEvent) => {
    if (e.clientX !== 0 || e.clientY !== 0) {
      setDragPosition({ x: e.clientX, y: e.clientY });
    }
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedFactoryIndex(null);
    setDragPosition(null);
  };

  // Handle drag over zone
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle drop on zone (receives the zone's originalName)
  const handleDropOnZone = (targetOriginalZoneName: string) => {
    if (draggedFactoryIndex !== null) {
      moveFactoryToZone(draggedFactoryIndex, targetOriginalZoneName);
      setDraggedFactoryIndex(null);
      setDragPosition(null);
    }
  };

  // Get the dragged factory for preview
  const draggedFactory = draggedFactoryIndex !== null ? factoryConfigs[draggedFactoryIndex] : null;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Import string input */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Paste export string:
        </label>
        <textarea
          value={importString}
          onChange={e => setImportString(e.target.value)}
          placeholder="Paste your factory export string here..."
          className="w-full h-16 p-2 bg-gray-700 rounded text-[10px] font-mono resize-none"
          data-testid="import-textarea"
          aria-label="Paste your factory export"
        />
      </div>

      {/* Error message */}
      {parseError && (
        <div className="p-3 bg-red-900/50 border border-red-500 rounded text-red-200">
          <ExclamationTriangleIcon className="w-5 h-5 inline mr-2" />
          {parseError}
        </div>
      )}

      {/* Import data parsed successfully */}
      {importData && (
        <>
          {/* Summary and Reset */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-400">
              Found {importData.factories.length}{' '}
              {importData.factories.length === 1 ? 'factory' : 'factories'} in{' '}
              {importData.zoneGroups.size}{' '}
              {importData.zoneGroups.size === 1 ? 'zone' : 'zones'}
            </div>
            {!importData.isSingleZone && (
              <button
                onClick={handleReset}
                className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 rounded cursor-pointer flex items-center gap-1"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>

          {/* Single zone mode: zone selection */}
          {importData.isSingleZone && (
            <div className="p-4 bg-gray-700 rounded">
              <div className="font-medium mb-3">Import destination:</div>
              
              <div className="flex flex-col gap-2">
                {/* Existing zone selection */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!createNewZone}
                    onChange={() => setCreateNewZone(false)}
                    className="w-4 h-4"
                  />
                  <span>Add to existing zone:</span>
                  <select
                    value={singleZoneTarget}
                    onChange={e => setSingleZoneTarget(e.target.value)}
                    disabled={createNewZone}
                    className="flex-1 p-2 bg-gray-600 rounded disabled:opacity-50"
                  >
                    {existingZones.map(z => (
                      <option key={z.id} value={z.name}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Create new zone */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={createNewZone}
                    onChange={() => setCreateNewZone(true)}
                    className="w-4 h-4"
                  />
                  <span>Create new zone:</span>
                  <input
                    type="text"
                    value={newZoneName}
                    onChange={e => setNewZoneName(e.target.value)}
                    disabled={!createNewZone}
                    placeholder="New zone name"
                    className="flex-1 p-2 bg-gray-600 rounded disabled:opacity-50"
                  />
                </label>

                {/* Zone name collision warning */}
                {createNewZone && existingZoneNames.includes(newZoneName) && (
                  <div className="text-sm text-yellow-400">
                    <ExclamationTriangleIcon className="w-4 h-4 inline mr-1" />
                    A zone with this name already exists
                  </div>
                )}

                {/* Zone modifier opt-in */}
                {singleZoneAvailableModifiers && (
                  <ModifierImportSection
                    availableModifiers={singleZoneAvailableModifiers}
                    importModifiers={singleZoneImportModifiers}
                    existingZone={!createNewZone}
                    currentModifiers={!createNewZone ? existingZoneInfos.find(z => z.name === singleZoneTarget)?.modifiers : undefined}
                    onToggle={() => setSingleZoneImportModifiers(v => !v)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Multi-zone mode: drag hint and add zone button */}
          {!importData.isSingleZone && (
            <div className="flex items-center justify-between px-2">
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <ArrowsUpDownIcon className="w-4 h-4" />
                Drag factories between zones to reorganize
              </div>
              <button
                onClick={handleAddNewZone}
                className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded cursor-pointer"
              >
                + Add Zone
              </button>
            </div>
          )}

          {/* Factory selection list */}
          <div className="flex-1 overflow-y-auto border border-gray-600 rounded min-h-[200px] max-h-[400px]">
            {importData.isSingleZone ? (
              // Single zone: show flat list of factories
              <div className="p-2 space-y-1">
                {factoryConfigs.map(config => (
                  <FactoryImportRow
                    key={config.index}
                    config={config}
                    onToggle={() => toggleFactorySelection(config.index)}
                    onNameChange={name => updateFactoryName(config.index, name)}
                    collision={factoryCollisions.get(config.index)}
                    draggable={false}
                  />
                ))}
              </div>
            ) : (
              // Multi-zone: show zones with factories (with drag and drop)
              <div className="p-2 space-y-3">
                {zonesWithFactories.map(zoneInfo => {
                  const zoneFactories = zoneInfo.factories;
                  const allSelected = zoneFactories.length > 0 && zoneFactories.every(f => f.selected);
                  const someSelected = zoneFactories.some(f => f.selected);
                  const isEmpty = zoneFactories.length === 0;
                  const isDragTarget = draggedFactoryIndex !== null;

                  return (
                    <div 
                      key={zoneInfo.originalName} 
                      className={`rounded border transition-colors ${
                        isDragTarget 
                          ? 'border-blue-500 border-dashed' 
                          : 'border-gray-600'
                      } ${isEmpty ? 'opacity-60' : ''}`}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDropOnZone(zoneInfo.originalName)}
                    >
                      {/* Zone header */}
                      <div className={`flex items-center gap-2 p-2 ${isEmpty ? 'bg-gray-800' : 'bg-gray-700'} rounded-t`}>
                        <div
                          className={`w-4 h-4 border-2 rounded flex items-center justify-center cursor-pointer shrink-0 ${
                            allSelected
                              ? 'bg-blue-500 border-blue-500'
                              : someSelected
                              ? 'bg-blue-500/50 border-blue-500'
                              : 'border-gray-500'
                          }`}
                          onClick={() => toggleZoneSelection(zoneInfo.originalName)}
                        >
                          {(allSelected || someSelected) && (
                            <CheckIcon className="w-3 h-3 text-white" />
                          )}
                        </div>
                        
                        {/* Zone destination selector: dropdown for existing zones or text input for new */}
                        <ZoneDestinationSelector
                          targetName={zoneInfo.targetName}
                          existingZones={existingZones}
                          existingZoneNames={existingZoneNames}
                          onSelect={(name, isExisting) => {
                            setZoneConfigs(prev =>
                              prev.map(z =>
                                z.originalName === zoneInfo.originalName
                                  ? { ...z, targetName: name, createNew: !isExisting }
                                  : z
                              )
                            );
                            // Also update factory target zone names
                            setFactoryConfigs(prev =>
                              prev.map(c =>
                                c.originalZoneName === zoneInfo.originalName
                                  ? { ...c, targetZoneName: name }
                                  : c
                              )
                            );
                          }}
                        />

                        <div className="text-xs shrink-0">
                          {zoneInfo.createNew ? (
                            <span className="text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">New</span>
                          ) : (
                            <span className="text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">Existing</span>
                          )}
                        </div>

                        {isEmpty && (
                          <span className="text-xs text-gray-500 italic">Empty - drop factories here</span>
                        )}
                      </div>

                      {/* Zone name collision warning */}
                      {zoneInfo.createNew &&
                        existingZoneNames.includes(zoneInfo.targetName) && (
                          <div className="px-2 py-1 text-xs text-yellow-400 bg-yellow-500/10">
                            <ExclamationTriangleIcon className="w-3 h-3 inline mr-1" />
                            Zone exists. Select it from dropdown or rename.
                          </div>
                        )}

                      {/* Zone modifier opt-in */}
                      {zoneInfo.availableModifiers && (
                        <div className="px-2 py-1 border-t border-gray-600">
                          <ModifierImportSection
                            availableModifiers={zoneInfo.availableModifiers}
                            importModifiers={zoneInfo.importModifiers}
                            existingZone={!zoneInfo.createNew}
                            currentModifiers={!zoneInfo.createNew ? existingZoneInfos.find(z => z.name === zoneInfo.targetName)?.modifiers : undefined}
                            onToggle={() => {
                              setZoneConfigs(prev =>
                                prev.map(z =>
                                  z.originalName === zoneInfo.originalName
                                    ? { ...z, importModifiers: !z.importModifiers }
                                    : z
                                )
                              );
                            }}
                          />
                        </div>
                      )}

                      {/* Factories in zone */}
                      {zoneFactories.length > 0 && (
                        <div className="p-2 space-y-1 bg-gray-800/50">
                          {zoneFactories.map(config => (
                            <FactoryImportRow
                              key={config.index}
                              config={config}
                              onToggle={() => toggleFactorySelection(config.index)}
                              onNameChange={name => updateFactoryName(config.index, name)}
                              collision={factoryCollisions.get(config.index)}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, config.index)}
                              onDrag={handleDrag}
                              onDragEnd={handleDragEnd}
                              isDragging={draggedFactoryIndex === config.index}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Drag preview portal */}
          {draggedFactory && dragPosition && createPortal(
            <div
              className="fixed pointer-events-none z-50 bg-gray-800 text-white px-3 py-2 rounded shadow-lg text-sm border border-blue-500"
              style={{
                left: dragPosition.x + 10,
                top: dragPosition.y + 10,
              }}
            >
              {draggedFactory.data.icon && (
                <img src={draggedFactory.data.icon} alt="" className="w-4 h-4 inline mr-2" />
              )}
              {draggedFactory.name}
            </div>,
            document.body
          )}

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={!canImport || isImporting}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded cursor-pointer font-medium"
            data-testid="import-factories-button"
          >
            {isImporting
              ? 'Importing...'
              : `Import ${selectedCount} ${selectedCount === 1 ? 'Factory' : 'Factories'}`}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Row component for factory import configuration
 */
function FactoryImportRow({
  config,
  onToggle,
  onNameChange,
  collision,
  draggable = false,
  onDragStart,
  onDrag,
  onDragEnd,
  isDragging = false,
}: {
  config: FactoryImportConfig;
  onToggle: () => void;
  onNameChange: (name: string) => void;
  collision?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDrag?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}) {
  return (
    <div 
      className={`flex items-center gap-2 p-2 rounded transition-opacity ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-30 bg-gray-700' : 'bg-gray-800'}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
    >
      <div
        className={`w-4 h-4 border-2 rounded flex items-center justify-center cursor-pointer shrink-0 ${
          config.selected ? 'bg-blue-500 border-blue-500' : 'border-gray-500'
        }`}
        onClick={onToggle}
      >
        {config.selected && <CheckIcon className="w-3 h-3 text-white" />}
      </div>

      {config.data.icon && (
        <img src={config.data.icon} alt="" className="w-5 h-5 shrink-0" />
      )}

      <input
        type="text"
        value={config.name}
        onChange={e => onNameChange(e.target.value)}
        className={`flex-1 p-1 bg-gray-700 rounded text-sm ${
          collision ? 'border border-yellow-500' : ''
        }`}
      />

      <span className="text-xs text-gray-500 shrink-0">
        {config.data.nodes.length} nodes
      </span>

      {collision && (
        <span className="text-xs text-yellow-400 shrink-0" title="Factory will be created with a unique ID">⚠ {collision}</span>
      )}
    </div>
  );
}

/**
 * Zone destination selector - dropdown for existing zones or text input for new
 */
function ZoneDestinationSelector({
  targetName,
  existingZones,
  existingZoneNames,
  onSelect,
}: {
  targetName: string;
  existingZones: Array<{ id: string; name: string }>;
  existingZoneNames: string[];
  onSelect: (name: string, isExisting: boolean) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(targetName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input value with prop
  useEffect(() => {
    if (!isEditing) {
      setInputValue(targetName);
    }
  }, [targetName, isEditing]);

  const isExisting = existingZoneNames.includes(targetName);

  const handleSelectExisting = (name: string) => {
    onSelect(name, true);
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    // Check if it matches an existing zone
    const matchesExisting = existingZoneNames.includes(value);
    onSelect(value, matchesExisting);
  };

  const handleInputFocus = () => {
    setIsEditing(true);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
  };

  return (
    <div className="flex-1 flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        className="flex-1 p-1.5 bg-gray-600 rounded text-sm min-w-0"
        placeholder="Zone name"
      />
      
      {/* Dropdown to select existing zone */}
      {existingZones.length > 0 && (
        <div className="relative">
          <select
            value={isExisting ? targetName : ''}
            onChange={e => {
              if (e.target.value) {
                handleSelectExisting(e.target.value);
              }
            }}
            className="appearance-none bg-gray-600 rounded p-1.5 pr-6 text-sm cursor-pointer hover:bg-gray-500"
            aria-label="Select existing zone"
          >
            <option value="">Select...</option>
            {existingZones.map(z => (
              <option key={z.id} value={z.name}>
                {z.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
        </div>
      )}
    </div>
  );
}

/**
 * Zone modifier import opt-in section.
 * Shows a checkbox to apply exported modifiers, plus collapsible summaries of
 * incoming values and (when overwriting) the values currently in the zone.
 */
function ModifierImportSection({
  availableModifiers,
  importModifiers,
  existingZone,
  currentModifiers,
  onToggle,
}: {
  availableModifiers: ZoneModifiers;
  importModifiers: boolean;
  /** True when importing into an existing zone */
  existingZone: boolean;
  /** Current modifiers of the target zone, present when overwriting an existing zone */
  currentModifiers?: ZoneModifiers;
  onToggle: () => void;
}) {
  const nonDefaultIncoming = (Object.keys(availableModifiers) as Array<keyof ZoneModifiers>).filter(
    k => availableModifiers[k] !== DEFAULT_ZONE_MODIFIERS[k]
  );
  const nonDefaultCurrent = currentModifiers
    ? (Object.keys(currentModifiers) as Array<keyof ZoneModifiers>).filter(
        k => currentModifiers[k] !== DEFAULT_ZONE_MODIFIERS[k]
      )
    : [];

  const formatVal = (key: keyof ZoneModifiers, val: number) => {
    const meta = MODIFIER_META[key];
    return meta.isAbsolute ? `${Math.round(val * 100)}%` : `×${val.toFixed(2)}`;
  };

  return (
    <div className="flex flex-col gap-1 mt-1">
      {/* Checkbox row */}
      <label
        className="flex items-center gap-2 text-xs cursor-pointer"
        title={existingZone ? 'Will overwrite current zone modifiers' : undefined}
      >
        <input
          type="checkbox"
          checked={importModifiers}
          onChange={onToggle}
          className="w-3.5 h-3.5"
        />
        <span>Import zone modifiers</span>
        {existingZone && (
          <span className="text-yellow-400">(will overwrite current modifiers)</span>
        )}
      </label>

      {/* Incoming modifier summary */}
      <details className="ml-5">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300 select-none">
          Importing:{' '}
          {nonDefaultIncoming.length === 0
            ? 'all default values'
            : `${nonDefaultIncoming.length} non-default`}
        </summary>
        {nonDefaultIncoming.length > 0 ? (
          <div className="mt-1 space-y-0.5 pl-2 border-l border-gray-600">
            {nonDefaultIncoming.map(key => (
              <div key={key} className="flex justify-between text-xs text-yellow-300 gap-4">
                <span>{MODIFIER_META[key].label}</span>
                <span className="font-mono">{formatVal(key, availableModifiers[key])}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-1 pl-2 text-xs text-gray-500 italic">All modifiers are default values</div>
        )}
      </details>

      {/* Current zone modifier summary (only shown when overwriting an existing zone) */}
      {existingZone && currentModifiers && (
        <details className="ml-5">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300 select-none">
            Current zone:{' '}
            {nonDefaultCurrent.length === 0
              ? 'all default values'
              : `${nonDefaultCurrent.length} non-default`}
          </summary>
          {nonDefaultCurrent.length > 0 ? (
            <div className="mt-1 space-y-0.5 pl-2 border-l border-gray-500">
              {nonDefaultCurrent.map(key => (
                <div key={key} className="flex justify-between text-xs text-gray-300 gap-4">
                  <span>{MODIFIER_META[key].label}</span>
                  <span className="font-mono">{formatVal(key, currentModifiers[key])}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-1 pl-2 text-xs text-gray-500 italic">All modifiers are default values</div>
          )}
        </details>
      )}
    </div>
  );
}
