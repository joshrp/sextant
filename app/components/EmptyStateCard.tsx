import type { ReactNode } from "react";

type EmptyStateCardProps = {
  /** Optional icon element (e.g., HeroIcon component or img) */
  icon?: ReactNode;
  /** Text content — string or JSX */
  text: ReactNode;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Render inline within a sidebar section (compact) vs. centered on canvas (spacious) */
  variant?: "inline" | "centered";
};

export default function EmptyStateCard({ icon, text, action, variant = "inline" }: EmptyStateCardProps) {
  return (
    <div
      className={`empty-state-card flex flex-col items-center gap-2 text-center
        rounded border border-gray-700 border-dashed
        text-gray-500 text-sm select-none
        ${variant === "centered"
          ? "p-8 max-w-sm"
          : "p-3 w-full"
        }`}
    >
      {icon && (
        <div className="empty-state-icon w-8 h-8 text-gray-600">
          {icon}
        </div>
      )}
      <p className="empty-state-text leading-relaxed">{text}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 
            text-gray-300 text-xs cursor-pointer border border-gray-600
            transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
