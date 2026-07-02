import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Clock,
  Rows3,
  X,
  ArrowDownUp,
  Download,
  Loader2,
  ChevronDown,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import type { DatasetMeta, QuerySpec, SortSpec } from "@/types";
import { countMatching, exportCsv } from "@/duckdb/db";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/components/ui/toast";
import { VirtualTable } from "./VirtualTable";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { formatCount, formatDuration } from "@/lib/utils";

const XLSX_ROW_LIMIT = 100_000;

interface WorkspaceProps {
  dataset: DatasetMeta;
}

export function Workspace({ dataset }: WorkspaceProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortSpec | null>(null);
  const [total, setTotal] = useState(dataset.rowCount);
  const [countMs, setCountMs] = useState<number | null>(null);
  const [queryMs, setQueryMs] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

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
  const { toast } = useToast();

  function download(bytes: Uint8Array, ext: string, mime: string) {
    const blob = new Blob([bytes as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = dataset.label.replace(/\.[^.]+$/, "");
    a.href = url;
    a.download = `${base}${filtered ? "-filtered" : ""}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleExport(format: "csv" | "xlsx") {
    if (format === "xlsx" && total > XLSX_ROW_LIMIT) {
      toast(
        `Too many rows for XLSX (${formatCount(total)} > ${formatCount(
          XLSX_ROW_LIMIT,
        )}). Export as CSV instead.`,
        "error",
      );
      return;
    }
    setExporting(true);
    try {
      const csv = await exportCsv(spec, dataset.columns);
      if (format === "csv") {
        download(csv, "csv", "text/csv");
      } else {
        // Convert the CSV DuckDB produced into a real .xlsx via SheetJS.
        const XLSX = await import("xlsx");
        const wb = XLSX.read(new TextDecoder().decode(csv), { type: "string" });
        const out = XLSX.write(wb, {
          type: "array",
          bookType: "xlsx",
        }) as ArrayBuffer;
        download(
          new Uint8Array(out),
          "xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      }
      toast(
        `Exported ${formatCount(total)} rows as ${format.toUpperCase()}`,
        "success",
      );
    } catch (e) {
      toast(
        `Export failed: ${e instanceof Error ? e.message : String(e)}`,
        "error",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search, or filter: quantity=1  price>100  category=Books  path:orders"
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={exporting || total === 0}
              title={`Export ${filtered ? "the filtered" : "all"} rows`}
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export{filtered ? ` ${formatCount(total)}` : ""}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => handleExport("csv")}>
              <FileText className="h-4 w-4 text-muted-foreground" /> CSV
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleExport("xlsx")}>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" /> Excel
              (XLSX)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
