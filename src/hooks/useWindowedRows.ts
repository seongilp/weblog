import { useCallback, useEffect, useRef, useState } from "react";
import type { ColumnMeta, QuerySpec } from "@/types";
import { fetchWindow } from "@/duckdb/db";

const PAGE_SIZE = 200;
/** Hard cap on rows held in JS at once — the "only 10k in the DOM-cache" budget. */
const MAX_PAGES = 50; // 50 * 200 = 10,000 rows

type Row = unknown[];

interface WindowState {
  /** Bump to force a re-render when pages settle. */
  tick: number;
  lastQueryMs: number | null;
}

export interface WindowedRows {
  getRow: (index: number) => Row | undefined;
  ensureRange: (start: number, end: number) => void;
  /** Drop the cached page holding this row and refetch it (after an edit). */
  invalidate: (rowIndex: number) => void;
  lastQueryMs: number | null;
  cachedRows: number;
}

/**
 * Lazily fetches sorted/filtered row windows from DuckDB and keeps at most
 * MAX_PAGES in an LRU cache. The virtualizer asks for visible indices; we
 * load the pages covering them and evict the least-recently-used.
 */
export function useWindowedRows(
  spec: QuerySpec,
  columns: ColumnMeta[],
  total: number,
): WindowedRows {
  const pages = useRef(new Map<number, Row[]>());
  const lru = useRef<number[]>([]);
  const inflight = useRef(new Set<number>());
  const [state, setState] = useState<WindowState>({
    tick: 0,
    lastQueryMs: null,
  });

  // Reset cache whenever the underlying query changes.
  const version = `${spec.table}|${spec.search}|${spec.sort?.column ?? ""}|${
    spec.sort?.dir ?? ""
  }`;
  useEffect(() => {
    pages.current.clear();
    lru.current = [];
    inflight.current.clear();
    setState((s) => ({ ...s, tick: s.tick + 1 }));
  }, [version]);

  const touch = useCallback((page: number) => {
    const idx = lru.current.indexOf(page);
    if (idx !== -1) lru.current.splice(idx, 1);
    lru.current.push(page);
    while (lru.current.length > MAX_PAGES) {
      const evict = lru.current.shift();
      if (evict !== undefined) pages.current.delete(evict);
    }
  }, []);

  const loadPage = useCallback(
    async (page: number) => {
      if (pages.current.has(page) || inflight.current.has(page)) return;
      inflight.current.add(page);
      try {
        const result = await fetchWindow(
          spec,
          columns,
          page * PAGE_SIZE,
          PAGE_SIZE,
        );
        pages.current.set(page, result.rows as Row[]);
        touch(page);
        setState((s) => ({
          tick: s.tick + 1,
          lastQueryMs: result.elapsedMs,
        }));
      } catch {
        // Leave the page empty; the scroller shows a skeleton row.
      } finally {
        inflight.current.delete(page);
      }
    },
    [spec, columns, touch],
  );

  const ensureRange = useCallback(
    (start: number, end: number) => {
      if (total === 0) return;
      const first = Math.max(0, Math.floor(start / PAGE_SIZE));
      const last = Math.min(
        Math.floor((end - 1) / PAGE_SIZE),
        Math.floor((total - 1) / PAGE_SIZE),
      );
      for (let p = first; p <= last; p++) {
        if (!pages.current.has(p)) void loadPage(p);
        else touch(p);
      }
    },
    [loadPage, touch, total],
  );

  const invalidate = useCallback(
    (rowIndex: number) => {
      const page = Math.floor(rowIndex / PAGE_SIZE);
      pages.current.delete(page);
      const idx = lru.current.indexOf(page);
      if (idx !== -1) lru.current.splice(idx, 1);
      inflight.current.delete(page);
      void loadPage(page);
    },
    [loadPage],
  );

  const getRow = useCallback(
    (index: number): Row | undefined => {
      const page = Math.floor(index / PAGE_SIZE);
      const bucket = pages.current.get(page);
      if (!bucket) return undefined;
      return bucket[index % PAGE_SIZE];
    },
    // state.tick dependency makes consumers re-read after a page loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.tick],
  );

  return {
    getRow,
    ensureRange,
    invalidate,
    lastQueryMs: state.lastQueryMs,
    cachedRows: pages.current.size * PAGE_SIZE,
  };
}
