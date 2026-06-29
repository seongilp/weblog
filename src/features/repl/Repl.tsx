import { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Database, AlertCircle, Clock, Table2 } from "lucide-react";
import type { SQLNamespace } from "@codemirror/lang-sql";
import { runSql, listTables, type SqlResult } from "@/duckdb/db";
import type { ColumnMeta } from "@/types";
import { SqlEditor } from "./SqlEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cellText } from "@/lib/format";
import { formatCount, formatDuration } from "@/lib/utils";

const MAX_DISPLAY_ROWS = 2000;

interface ReplProps {
  defaultTable?: string;
  columns?: ColumnMeta[];
}

export function Repl({ defaultTable, columns }: ReplProps) {
  const [sql, setSql] = useState(
    defaultTable
      ? `SELECT level, count(*) AS n\nFROM ${defaultTable}\nGROUP BY level\nORDER BY n DESC;`
      : "SELECT 42 AS answer;",
  );
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [tables, setTables] = useState<string[]>([]);

  useEffect(() => {
    listTables().then(setTables).catch(() => {});
  }, []);

  // Schema for autocompletion: every table name, with columns for the active one.
  const schema = useMemo<SQLNamespace>(() => {
    const ns: Record<string, string[]> = {};
    for (const tname of tables) {
      ns[tname] =
        tname === defaultTable ? (columns ?? []).map((c) => c.name) : [];
    }
    if (defaultTable && !ns[defaultTable]) {
      ns[defaultTable] = (columns ?? []).map((c) => c.name);
    }
    return ns;
  }, [tables, defaultTable, columns]);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await runSql(sql);
      setResult(res);
      listTables().then(setTables).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, [sql]);

  return (
    <div className="flex h-full gap-3">
      {/* Schema sidebar */}
      <div className="hidden w-48 shrink-0 flex-col gap-1 overflow-auto rounded-lg border border-border bg-card/40 p-2 md:flex">
        <div className="mb-1 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
          <Database className="h-3.5 w-3.5" /> Tables
        </div>
        {tables.length === 0 && (
          <p className="px-1 text-xs text-muted-foreground/60">No tables yet</p>
        )}
        {tables.map((t) => (
          <button
            key={t}
            onClick={() =>
              setSql((s) => `${s.trimEnd()}\nSELECT * FROM ${t} LIMIT 100;`)
            }
            className="flex items-center gap-1.5 rounded px-2 py-1 text-left font-mono text-xs text-foreground/80 hover:bg-secondary/50"
          >
            <Table2 className="h-3 w-3 shrink-0 opacity-60" />
            <span className="truncate">{t}</span>
          </button>
        ))}
      </div>

      {/* Editor + results */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="relative overflow-hidden rounded-lg border border-input bg-background/60 shadow-sm focus-within:ring-2 focus-within:ring-ring">
          <SqlEditor
            value={sql}
            onChange={setSql}
            onRun={run}
            schema={schema}
            defaultTable={defaultTable}
          />
          <div className="absolute right-3 top-2.5 z-10 flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={run} disabled={running}>
              <Play className="h-3.5 w-3.5" />
              {running ? "Running" : "Run"}
            </Button>
          </div>
          <span className="pointer-events-none absolute bottom-1.5 right-3 z-10 text-[10px] text-muted-foreground/50">
            ⌘/Ctrl + Enter
          </span>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <pre className="whitespace-pre-wrap font-mono">{error}</pre>
          </div>
        )}

        {result && !error && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card/40">
            <div className="flex shrink-0 items-center gap-3 border-b border-border bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground">
              <Badge variant="success">
                {formatCount(result.rowCount)} rows
              </Badge>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(result.elapsedMs)}
              </span>
              {result.rowCount > MAX_DISPLAY_ROWS && (
                <span className="text-warning">
                  showing first {formatCount(MAX_DISPLAY_ROWS)}
                </span>
              )}
            </div>
            <ResultGrid result={result} />
          </div>
        )}
      </div>
    </div>
  );
}

function ResultGrid({ result }: { result: SqlResult }) {
  const rows = result.rows.slice(0, MAX_DISPLAY_ROWS);
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-secondary/60 backdrop-blur">
          <tr>
            <th className="border-b border-border px-3 py-1.5 text-right font-mono text-[10px] text-muted-foreground/60">
              #
            </th>
            {result.columns.map((c) => (
              <th
                key={c}
                className="border-b border-border px-3 py-1.5 text-left font-mono font-medium text-muted-foreground"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 1 ? "bg-secondary/15" : ""}>
              <td className="px-3 py-1 text-right font-mono text-[10px] tabular-nums text-muted-foreground/50">
                {ri + 1}
              </td>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="max-w-md truncate px-3 py-1 font-mono text-[11.5px] text-foreground/90"
                >
                  {cellText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
