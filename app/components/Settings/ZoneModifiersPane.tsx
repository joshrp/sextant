import { ArrowPathIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { default as useProductionZone, useProductionZoneStore } from '~/context/ZoneContext';
import {
  DEFAULT_ZONE_MODIFIERS,
  MODIFIER_GROUP_LABELS,
  MODIFIER_GROUP_ORDER,
  MODIFIER_META,
  type ModifierGroup,
  type ZoneModifiers,
} from '~/context/zoneModifiers';
import { uiIcon } from '~/uiUtils';

/** Step used by the +/− buttons — always 5% regardless of meta.step. */
const BUTTON_STEP = 0.05;

// ─── Header ───────────────────────────────────────────────────────────────────

function WikiLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 hover:underline"
    >
      {children}
    </a>
  );
}

function Header() {
  const { name } = useProductionZone();
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-1">
        Edicts &amp; Research
        <span className="ml-2 font-normal text-blue-300">— {name}</span>
      </h2>
      <p className="text-sm text-gray-400 leading-relaxed">
        Adjust these multipliers to match your current difficulty settings,{' '}
        <WikiLink href="https://wiki.coigame.com/Edicts">active edicts</WikiLink>
        , and{' '}
        <WikiLink href="https://wiki.coigame.com/Research">research</WikiLink>
        {' '}for this zone. You can enter any value to model custom scenarios.
        Changes only affect this zone's calculations.
      </p>
    </div>
  );
}

// ─── Modifier Row ─────────────────────────────────────────────────────────────

function ModifierRow({ modKey }: { modKey: keyof ZoneModifiers }) {
  const meta = MODIFIER_META[modKey];
  const value = useProductionZoneStore(state => state.modifiers[modKey]);
  const setModifier = useProductionZoneStore(state => state.setModifier);

  const isDefault = value === meta.default;

  // Display as percentage with up to 1 decimal place
  const displayValue = Math.round(value * 1000) / 10;

  const handleDecrement = () => {
    const next = Math.round((value - BUTTON_STEP) * 1e6) / 1e6;
    setModifier(modKey, next);
  };

  const handleIncrement = () => {
    const next = Math.round((value + BUTTON_STEP) * 1e6) / 1e6;
    setModifier(modKey, next);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseFloat(e.target.value);
    if (isNaN(pct)) return;
    const decimal = Math.round((pct / 100) * 1e6) / 1e6;
    setModifier(modKey, decimal);
  };

  const handleReset = () => setModifier(modKey, meta.default);

  return (
    <tr className={`border-b border-gray-800/60 ${isDefault ? '' : 'bg-blue-950/25'}`}>
      {/* Label + info icon */}
      <td className="py-2.5 pr-6 w-1/2">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${isDefault ? 'text-gray-300' : 'text-blue-200 font-medium'}`}>
            {meta.label}
          </span>
          <button
            className="text-gray-600 hover:text-gray-300 focus:text-gray-300 cursor-help flex-shrink-0"
            title={meta.tooltip}
            aria-label={`Info: ${meta.label}`}
            tabIndex={0}
          >
            <InformationCircleIcon className="w-4 h-4" />
          </button>
        </div>
        {!isDefault && (
          <div className="text-xs text-gray-500 mt-0.5">
            default: {Math.round(meta.default * 100)}%
          </div>
        )}
      </td>

      {/* Controls */}
      <td className="py-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={handleDecrement}
            aria-label="Decrease by 5%"
            className="w-7 h-7 flex items-center justify-center text-base text-gray-400 hover:text-white cursor-pointer rounded hover:bg-gray-600 transition-colors select-none"
          >
            −
          </button>
          <input
            type="number"
            value={displayValue}
            onChange={handleChange}
            step={5}
            aria-label={`${meta.label} (%)`}
            className="w-20 text-right text-sm bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
          />
          <span className="text-gray-400 text-sm select-none">%</span>
          <button
            onClick={handleIncrement}
            aria-label="Increase by 5%"
            className="w-7 h-7 flex items-center justify-center text-base text-gray-400 hover:text-white cursor-pointer rounded hover:bg-gray-600 transition-colors select-none"
          >
            +
          </button>
        </div>
      </td>

      {/* Per-row reset */}
      <td className="py-2.5 pl-4 w-8">
        <button
          onClick={handleReset}
          title={isDefault ? 'Already at default' : `Reset ${meta.label} to default`}
          aria-label={isDefault ? `${meta.label} is already at default` : `Reset ${meta.label} to default`}
          disabled={isDefault}
          className="text-gray-600 hover:text-gray-300 disabled:opacity-0 disabled:pointer-events-none cursor-pointer transition-colors"
        >
          <ArrowPathIcon className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

// ─── Modifier Group ───────────────────────────────────────────────────────────

function ModifierGroupSection({ group, keys }: { group: ModifierGroup; keys: (keyof ZoneModifiers)[] }) {
  return (
    <tbody>
      <tr>
        <td
          colSpan={3}
          className="pt-6 pb-2 text-xs font-semibold uppercase tracking-widest text-gray-400"
        >
          {MODIFIER_GROUP_LABELS[group] == 'Settlements' && (
            <img src={uiIcon('Settlement')} alt="Settlement icon" className="inline w-6 mr-2 " />
          )}
          {MODIFIER_GROUP_LABELS[group]}
        </td>
      </tr>
      {keys.map(key => <ModifierRow key={key} modKey={key} />)}
    </tbody>
  );
}

// ─── Main Pane ────────────────────────────────────────────────────────────────

// Static grouping derived from constant metadata — computed once at module level
const grouped = MODIFIER_GROUP_ORDER.map(group => ({
  group,
  keys: (Object.keys(MODIFIER_META) as (keyof ZoneModifiers)[]).filter(
    k => MODIFIER_META[k].group === group
  ),
}));

export default function ZoneModifiersPane() {
  const modifiers = useProductionZoneStore(state => state.modifiers);
  const resetModifiers = useProductionZoneStore(state => state.resetModifiers);

  const isModified = (Object.keys(modifiers) as (keyof ZoneModifiers)[]).some(
    k => modifiers[k] !== DEFAULT_ZONE_MODIFIERS[k]
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Header />

      <table className="w-full border-collapse">
        {grouped.map(({ group, keys }) => (
          <ModifierGroupSection key={group} group={group} keys={keys} />
        ))}
      </table>

      <div className="mt-8 flex justify-end border-t border-gray-700 pt-5">
        <button
          onClick={resetModifiers}
          disabled={!isModified}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 disabled:opacity-30 disabled:cursor-default cursor-pointer transition-colors"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Reset All to Defaults
        </button>
      </div>
    </div>
  );
}
