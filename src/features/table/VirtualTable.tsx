import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ColumnMeta, QuerySpec, SortSpec } from "@/types";
import { useWindowedRows } from "@/hooks/useWindowedRows";
import {
  alignClass,
  cellText,
  isLevelColumn,
  levelClass,
  timeCellText,
} from "@/lib/format";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 30;
const GUTTER_WIDTH = 64;
const MIN_COL_WIDTH = 120;

interface VirtualTableProps {
  columns: ColumnMeta[];
  spec: QuerySpec;
  total: number;
  onSortChange: (sort: SortSpec | null) => void;
  onQueryMs: (ms: number | null) => void;
}

export function VirtualTable({
  columns,
  spec,
  total,
  onSortChange,
  onQueryMs,
}: VirtualTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { getRow, ensureRange, lastQueryMs } = useWindowedRows(
    spec,
    columns,
    total,
  );

  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const items = virtualizer.getVirtualItems();

  useEffect(() => {
    if (items.length === 0) return;
    ensureRange(items[0].index, items[items.length - 1].index + 1);
  }, [items, ensureRange]);

  useEffect(() => {
    onQueryMs(lastQueryMs);
  }, [lastQueryMs, onQueryMs]);

  const gridTemplate = `${GUTTER_WIDTH}px repeat(${columns.length}, minmax(${MIN_COL_WIDTH}px, 1fr))`;

  function cycleSort(col: ColumnMeta) {
    if (spec.sort?.column !== col.name) {
      onSortChange({ column: col.name, dir: "asc" });
    } else if (spec.sort.dir === "asc") {
      onSortChange({ column: col.name, dir: "desc" });
    } else {
      onSortChange(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card/40">
      {/* Header */}
      <div
        className="grid shrink-0 border-b border-border bg-secondary/40 text-xs font-medium text-muted-foreground"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div className="flex items-center justify-end px-3 py-2 tabular-nums">
          #
        </div>
        {columns.map((col) => {
          const active = spec.sort?.column === col.name;
          return (
            <button
              key={col.name}
              onClick={() => cycleSort(col)}
              className={cn(
                "group flex items-center gap-1 px-3 py-2 text-left transition-colors hover:bg-secondary/60",
                col.kind === "number" && "justify-end",
                active && "text-foreground",
              )}
              title={`${col.name} · ${col.type}`}
            >
              <span className="truncate font-mono">{col.name}</span>
              {active ? (
                spec.sort?.dir === "asc" ? (
                  <ArrowUp className="h-3 w-3 shrink-0" />
                ) : (
                  <ArrowDown className="h-3 w-3 shrink-0" />
                )
              ) : (
                <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50" />
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        {total === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No rows match the current filter.
          </div>
        ) : (
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {items.map((vrow) => {
              const row = getRow(vrow.index);
              return (
                <div
                  key={vrow.key}
                  className={cn(
                    "absolute left-0 top-0 grid w-full items-center border-b border-border/40 text-xs",
                    vrow.index % 2 === 1 && "bg-secondary/15",
                  )}
                  style={{
                    height: ROW_HEIGHT,
                    transform: `translateY(${vrow.start}px)`,
                    gridTemplateColumns: gridTemplate,
                  }}
                >
                  <div className="px-3 text-right font-mono text-[11px] tabular-nums text-muted-foreground/60">
                    {vrow.index + 1}
                  </div>
                  {row
                    ? columns.map((col, ci) => (
                        <Cell key={col.name} col={col} value={row[ci]} />
                      ))
                    : columns.map((col) => (
                        <div key={col.name} className="px-3">
                          <div className="h-3 w-2/3 animate-pulse rounded bg-secondary/50" />
                        </div>
                      ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({ col, value }: { col: ColumnMeta; value: unknown }) {
  const text = col.kind === "time" ? timeCellText(value) : cellText(value);
  if (isLevelColumn(col) && text) {
    return (
      <div className="px-3">
        <span
          className={cn(
            "inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase",
            levelClass(text),
          )}
        >
          {text}
        </span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "truncate px-3 font-mono text-[11.5px] text-foreground/90",
        alignClass(col),
      )}
      title={text.length > 80 ? text : undefined}
    >
      {text}
    </div>
  );
}
