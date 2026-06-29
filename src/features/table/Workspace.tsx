import { useEffect, useMemo, useState } from "react";
import { Search, Clock, Rows3, X, ArrowDownUp } from "lucide-react";
import type { DatasetMeta, QuerySpec, SortSpec } from "@/types";
import { countMatching } from "@/duckdb/db";
import { useDebounce } from "@/hooks/useDebounce";
import { VirtualTable } from "./VirtualTable";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCount, formatDuration } from "@/lib/utils";

interface WorkspaceProps {
  dataset: DatasetMeta;
}

export function Workspace({ dataset }: WorkspaceProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortSpec | null>(null);
  const [total, setTotal] = useState(dataset.rowCount);
  const [countMs, setCountMs] = useState<number | null>(null);
  const [queryMs, setQueryMs] = useState<number | null>(null);

  const debouncedSearch = useDebounce(search, 180);

  const spec: QuerySpec = useMemo(
    () => ({ table: dataset.table, search: debouncedSearch, sort }),
    [dataset.table, debouncedSearch, sort],
  );

  // Recompute the filtered row count whenever the search changes.
  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    countMatching(spec, dataset.columns)
      .then((n) => {
        if (cancelled) return;
        setTotal(n);
        setCountMs(performance.now() - started);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [spec, dataset.columns]);

  const filtered = debouncedSearch.trim().length > 0;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search across all columns…"
            className="pl-9 pr-9 font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Badge variant={filtered ? "warning" : "muted"} className="h-9 px-3">
          <Rows3 className="h-3.5 w-3.5" />
          {formatCount(total)}
          {filtered && (
            <span className="opacity-60">/ {formatCount(dataset.rowCount)}</span>
          )}
        </Badge>

        {countMs !== null && (
          <Badge variant="outline" className="h-9 px-3" title="Filter/count time">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(countMs)}
          </Badge>
        )}
        {queryMs !== null && (
          <Badge
            variant="outline"
            className="h-9 px-3"
            title="Window fetch time"
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            {formatDuration(queryMs)}
          </Badge>
        )}

        {sort && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => setSort(null)}
          >
            <X className="h-3.5 w-3.5" />
            {sort.column} {sort.dir}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1">
        <VirtualTable
          columns={dataset.columns}
          spec={spec}
          total={total}
          onSortChange={setSort}
          onQueryMs={setQueryMs}
        />
      </div>
    </div>
  );
}
