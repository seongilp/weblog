import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ColumnMeta, QuerySpec, SortSpec } from "@/types";
import { useWindowedRows } from "@/hooks/useWindowedRows";
import { updateCell, clearCells } from "@/duckdb/db";
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

interface Pos {
  r: number;
  c: number;
}

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
  const { getRow, ensureRange, invalidate, invalidateRange, lastQueryMs } =
    useWindowedRows(spec, columns, total);

  // Selection: a rectangular range from `anchor` to `focus` (cell coords).
  const [anchor, setAnchor] = useState<Pos | null>(null);
  const [focus, setFocus] = useState<Pos | null>(null);
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const dragging = useRef(false);
  const wasEditing = useRef(false);

  // When an edit ends, return focus to the grid so arrow keys work again.
  useEffect(() => {
    if (editing) {
      wasEditing.current = true;
    } else if (wasEditing.current) {
      wasEditing.current = false;
      scrollRef.current?.focus({ preventScroll: true });
    }
  }, [editing]);

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

  // Reset selection when the query changes.
  useEffect(() => {
    setAnchor(null);
    setFocus(null);
    setEditing(null);
  }, [spec.table, spec.search, spec.sort?.column, spec.sort?.dir]);

  const range = useMemo(() => {
    if (!anchor || !focus) return null;
    return {
      r0: Math.min(anchor.r, focus.r),
      r1: Math.max(anchor.r, focus.r),
      c0: Math.min(anchor.c, focus.c),
      c1: Math.max(anchor.c, focus.c),
    };
  }, [anchor, focus]);

  const inRange = useCallback(
    (r: number, c: number) =>
      range !== null &&
      r >= range.r0 &&
      r <= range.r1 &&
      c >= range.c0 &&
      c <= range.c1,
    [range],
  );

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

  const select = useCallback((r: number, c: number, extend: boolean) => {
    setEditing(null);
    setFocus({ r, c });
    if (!extend) setAnchor({ r, c });
  }, []);

  const moveFocus = useCallback(
    (dr: number, dc: number, extend: boolean) => {
      setFocus((prev) => {
        const base = prev ?? { r: 0, c: 0 };
        const r = Math.min(Math.max(0, base.r + dr), Math.max(0, total - 1));
        const c = Math.min(Math.max(0, base.c + dc), columns.length - 1);
        if (!extend) setAnchor({ r, c });
        virtualizer.scrollToIndex(r, { align: "auto" });
        return { r, c };
      });
    },
    [total, columns.length, virtualizer],
  );

  const startEdit = useCallback(
    (r: number, c: number, initial?: string) => {
      const row = getRow(r);
      const current =
        initial ??
        (row
          ? columns[c].kind === "time"
            ? timeCellText(row[c + 1])
            : cellText(row[c + 1])
          : "");
      setAnchor({ r, c });
      setFocus({ r, c });
      setEditing({ r, c });
      // Seed the input value on next tick via the editing input's defaultValue.
      pendingValue.current = current;
    },
    [getRow, columns],
  );

  const pendingValue = useRef("");

  const commitEdit = useCallback(
    async (value: string, moveDown: boolean) => {
      if (!editing) return;
      const { r, c } = editing;
      const row = getRow(r);
      setEditing(null);
      if (row) {
        const rowId = row[0] as number | bigint;
        try {
          await updateCell(spec.table, rowId, columns[c], value);
          invalidate(r);
        } catch {
          /* keep the old value on failure */
        }
      }
      if (moveDown) moveFocus(1, 0, false);
    },
    [editing, getRow, spec.table, columns, invalidate, moveFocus],
  );

  const clearRange = useCallback(async () => {
    if (!range) return;
    try {
      await clearCells(
        spec,
        columns,
        range.r0,
        range.r1,
        range.c0,
        range.c1,
      );
      invalidateRange(range.r0, range.r1);
    } catch {
      /* ignore — values stay as they were */
    }
  }, [range, spec, columns, invalidateRange]);

  const copySelection = useCallback(async () => {
    if (!range) return;
    const lines: string[] = [];
    for (let r = range.r0; r <= range.r1; r++) {
      const row = getRow(r);
      const cells: string[] = [];
      for (let c = range.c0; c <= range.c1; c++) {
        cells.push(
          row
            ? columns[c].kind === "time"
              ? timeCellText(row[c + 1])
              : cellText(row[c + 1])
            : "",
        );
      }
      lines.push(cells.join("\t"));
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }, [range, getRow, columns]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (editing) return; // input handles its own keys
    const ext = e.shiftKey;
    const meta = e.metaKey || e.ctrlKey;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveFocus(meta ? total : 1, 0, ext);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveFocus(meta ? -total : -1, 0, ext);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(0, meta ? -columns.length : -1, ext);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveFocus(0, meta ? columns.length : 1, ext);
        break;
      case "PageDown":
        e.preventDefault();
        moveFocus(20, 0, ext);
        break;
      case "PageUp":
        e.preventDefault();
        moveFocus(-20, 0, ext);
        break;
      case "Home":
        e.preventDefault();
        moveFocus(0, -columns.length, ext);
        break;
      case "End":
        e.preventDefault();
        moveFocus(0, columns.length, ext);
        break;
      case "Enter":
      case "F2":
        if (focus) {
          e.preventDefault();
          startEdit(focus.r, focus.c);
        }
        break;
      case "c":
        if (meta) {
          e.preventDefault();
          void copySelection();
        }
        break;
      case "Delete":
      case "Backspace":
        if (range) {
          e.preventDefault();
          void clearRange();
        }
        break;
      case "Escape":
        setAnchor(focus);
        break;
      default:
        // Begin editing on a printable keystroke (Excel-style).
        if (
          focus &&
          !meta &&
          e.key.length === 1 &&
          columns[focus.c].kind !== "time"
        ) {
          startEdit(focus.r, focus.c, e.key);
        }
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
        {columns.map((col, ci) => {
          const active = spec.sort?.column === col.name;
          const colSelected =
            range !== null && ci >= range.c0 && ci <= range.c1;
          return (
            <button
              key={col.name}
              onClick={() => cycleSort(col)}
              className={cn(
                "group flex items-center gap-1 px-3 py-2 text-left transition-colors hover:bg-secondary/60",
                col.kind === "number" && "justify-end",
                (active || colSelected) && "text-foreground",
                colSelected && "bg-primary/10",
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
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseUp={() => (dragging.current = false)}
        onMouseLeave={() => (dragging.current = false)}
        className="relative flex-1 overflow-auto outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
      >
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
              const rowInSel =
                range !== null &&
                vrow.index >= range.r0 &&
                vrow.index <= range.r1;
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
                  <div
                    className={cn(
                      "px-3 text-right font-mono text-[11px] tabular-nums text-muted-foreground/60",
                      rowInSel && "bg-primary/10 text-foreground/80",
                    )}
                  >
                    {vrow.index + 1}
                  </div>
                  {row
                    ? columns.map((col, ci) => {
                        const isFocus =
                          focus?.r === vrow.index && focus?.c === ci;
                        const isEditing =
                          editing?.r === vrow.index && editing?.c === ci;
                        return (
                          <CellView
                            key={col.name}
                            col={col}
                            value={row[ci + 1]}
                            selected={inRange(vrow.index, ci)}
                            focused={isFocus}
                            editing={isEditing}
                            initialValue={pendingValue.current}
                            onMouseDown={(e) => {
                              dragging.current = true;
                              select(vrow.index, ci, e.shiftKey);
                              scrollRef.current?.focus();
                            }}
                            onMouseEnter={() => {
                              if (dragging.current)
                                setFocus({ r: vrow.index, c: ci });
                            }}
                            onDoubleClick={() => startEdit(vrow.index, ci)}
                            onCommit={(val, moveDown) =>
                              void commitEdit(val, moveDown)
                            }
                            onCancel={() => setEditing(null)}
                          />
                        );
                      })
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

interface CellViewProps {
  col: ColumnMeta;
  value: unknown;
  selected: boolean;
  focused: boolean;
  editing: boolean;
  initialValue: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onDoubleClick: () => void;
  onCommit: (value: string, moveDown: boolean) => void;
  onCancel: () => void;
}

function CellView({
  col,
  value,
  selected,
  focused,
  editing,
  initialValue,
  onMouseDown,
  onMouseEnter,
  onDoubleClick,
  onCommit,
  onCancel,
}: CellViewProps) {
  if (editing) {
    return (
      <div className="relative h-full">
        <input
          autoFocus
          defaultValue={initialValue}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => onCommit(e.currentTarget.value, false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit((e.target as HTMLInputElement).value, true);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            } else if (e.key === "Tab") {
              e.preventDefault();
              onCommit((e.target as HTMLInputElement).value, false);
            }
            e.stopPropagation();
          }}
          className="absolute inset-0 z-10 h-full w-full border border-primary bg-background px-3 font-mono text-[11.5px] text-foreground outline-none"
        />
      </div>
    );
  }

  const text = col.kind === "time" ? timeCellText(value) : cellText(value);
  const isLevel = isLevelColumn(col) && text;

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDoubleClick={onDoubleClick}
      className={cn(
        "h-full cursor-cell select-none truncate px-3 font-mono text-[11.5px] leading-[30px] text-foreground/90",
        !isLevel && alignClass(col),
        selected && "bg-primary/15",
        focused && "z-[1] ring-1 ring-inset ring-primary",
      )}
      title={text.length > 80 ? text : undefined}
    >
      {isLevel ? (
        <span
          className={cn(
            "inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase",
            levelClass(text),
          )}
        >
          {text}
        </span>
      ) : (
        text
      )}
    </div>
  );
}
