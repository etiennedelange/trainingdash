import clsx from "clsx";

export function StatTile({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-tile)] border border-line bg-card p-4">
      <div className={clsx("font-mono text-2xl font-bold", accent ? "text-accent" : "text-text")}>
        {value}
        {unit ? <span className="ml-1 font-sans text-xs font-semibold text-muted">{unit}</span> : null}
      </div>
      <div className="mt-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
        {label}
      </div>
    </div>
  );
}
