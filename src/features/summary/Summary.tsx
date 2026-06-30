import { useEffect, useState } from "react";
import {
  Hash,
  Type,
  Clock,
  ToggleLeft,
  Loader2,
  Fingerprint,
  CircleOff,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DatasetMeta, ColumnMeta } from "@/types";
import {
  summarize,
  topValues,
  type ColumnSummary,
  type ValueCount,
} from "@/duckdb/db";
import { Badge } from "@/components/ui/badge";
import { formatCount, formatDuration, cn } from "@/lib/utils";

/** Treat a column as categorical (worth a distribution) below this cardinality. */
const CATEGORICAL_MAX = 20;

interface SummaryProps {
  dataset: DatasetMeta;
}

const KIND_ICON: Record<ColumnMeta["kind"], LucideIcon> = {
  number: Hash,
  string: Type,
  time: Clock,
  boolean: ToggleLeft,
};

function kindOf(dataset: DatasetMeta, name: string): ColumnMeta["kind"] {
  return dataset.columns.find((c) => c.name === name)?.kind ?? "string";
}

/** Pretty-print a numeric stat string; pass through non-numbers. */
function fmtStat(v: string | null): string {
  if (v === null || v === "") return "—";
  const n = Number(v);
  if (Number.isFinite(n) && /^-?\d*\.?\d+$/.test(v.trim())) {
    if (Number.isInteger(n)) return n.toLocaleString("en-US");
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return v;
}

export function Summary({ dataset }: SummaryProps) {
  const [rows, setRows] = useState<ColumnSummary[] | null>(null);
  const [dist, setDist] = useState<Record<string, ValueCount[]>>({});
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setDist({});
    setError(null);
    summarize(dataset.table)
      .then(async ({ rows, elapsedMs }) => {
        if (cancelled) return;
        setRows(rows);
        setElapsedMs(elapsedMs);
        // Fetch value distributions for low-cardinality columns in parallel.
        const cats = rows.filter(
          (s) =>
            s.approxUnique !== null &&
            s.approxUnique > 0 &&
            s.approxUnique <= CATEGORICAL_MAX,
        );
        const entries = await Promise.all(
          cats.map(async (s) => {
            try {
              return [s.name, await topValues(dataset.table, s.name)] as const;
            } catch {
              return [s.name, []] as const;
            }
          }),
        );
        if (!cancelled) setDist(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [dataset.table]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
        {error}
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Summarizing
        {" "}
        {formatCount(dataset.rowCount)} rows…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="muted" className="gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" /> Column summary
        </Badge>
        <Badge variant="outline">
          {formatCount(dataset.rowCount)} rows · {rows.length} columns
        </Badge>
        {elapsedMs !== null && (
          <Badge variant="outline">SUMMARIZE {formatDuration(elapsedMs)}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((s) => (
          <ColumnCard
            key={s.name}
            summary={s}
            kind={kindOf(dataset, s.name)}
            total={dataset.rowCount}
            values={dist[s.name]}
          />
        ))}
      </div>
    </div>
  );
}

function ColumnCard({
  summary: s,
  kind,
  total,
  values,
}: {
  summary: ColumnSummary;
  kind: ColumnMeta["kind"];
  total: number;
  values?: ValueCount[];
}) {
  const Icon = KIND_ICON[kind];
  const hasDist = values && values.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate font-mono text-sm font-semibold text-foreground">
          {s.name}
        </span>
        <Badge variant="muted" className="ml-auto shrink-0 text-[10px]">
          {s.type}
        </Badge>
      </div>

      {/* Quick stats */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Stat
          icon={Fingerprint}
          label="unique"
          value={
            s.approxUnique !== null ? `~${formatCount(s.approxUnique)}` : "—"
          }
        />
        <Stat
          icon={CircleOff}
          label="null"
          value={`${s.nullPercentage.toFixed(s.nullPercentage % 1 === 0 ? 0 : 1)}%`}
          warn={s.nullPercentage > 0}
        />
      </div>

      {/* Body: distribution OR numeric/range stats */}
      {hasDist ? (
        <Distribution values={values!} total={total} />
      ) : kind === "number" ? (
        <NumericStats s={s} />
      ) : (
        <RangeStats s={s} />
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Icon className="h-3 w-3 opacity-70" />
      <span>{label}</span>
      <span
        className={cn(
          "font-mono font-medium",
          warn ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </span>
    </span>
  );
}

function Distribution({
  values,
  total,
}: {
  values: ValueCount[];
  total: number;
}) {
  const max = Math.max(...values.map((v) => v.count), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {values.map((v) => {
        const pct = total > 0 ? (v.count / total) * 100 : 0;
        return (
          <div key={v.value} className="flex items-center gap-2 text-[11px]">
            <span className="w-24 shrink-0 truncate font-mono text-foreground/90">
              {v.value}
            </span>
            <div className="relative h-3.5 flex-1 overflow-hidden rounded bg-secondary/40">
              <div
                className="h-full rounded bg-primary/70"
                style={{ width: `${(v.count / max) * 100}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
              {formatCount(v.count)}
              <span className="ml-1 opacity-60">{pct.toFixed(1)}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NumericStats({ s }: { s: ColumnSummary }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-[11px]">
      <Cell label="min" value={fmtStat(s.min)} />
      <Cell label="avg" value={fmtStat(s.avg)} />
      <Cell label="max" value={fmtStat(s.max)} />
      <Cell label="p25" value={fmtStat(s.q25)} />
      <Cell label="p50" value={fmtStat(s.q50)} />
      <Cell label="p75" value={fmtStat(s.q75)} />
    </div>
  );
}

function RangeStats({ s }: { s: ColumnSummary }) {
  return (
    <div className="grid grid-cols-1 gap-2 text-[11px]">
      <Cell label="min" value={fmtStat(s.min)} />
      <Cell label="max" value={fmtStat(s.max)} />
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/30 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground/70">
        {label}
      </div>
      <div className="truncate font-mono text-foreground" title={value}>
        {value}
      </div>
    </div>
  );
}
