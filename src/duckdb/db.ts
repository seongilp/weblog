import * as duckdb from "@duckdb/duckdb-wasm";
import type {
  ColumnMeta,
  DatasetMeta,
  QuerySpec,
  QueryResult,
  SourceKind,
} from "@/types";

/* The DuckDB wasm bundles (35–41 MiB) are served from the jsDelivr CDN rather
 * than bundled, so the static deploy stays tiny and well under host file-size
 * limits. The data you load still never leaves the browser. */

/** Columns prefixed with __ are internal (ordering helpers) and hidden. */
const INTERNAL_PREFIX = "__";
export const ROW_ID = "__row_id";

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

async function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const bundles = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(bundles);
      // Wrap the cross-origin CDN worker in a same-origin blob so the Worker
      // constructor accepts it (importScripts can pull cross-origin scripts).
      const workerUrl = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], {
          type: "text/javascript",
        }),
      );
      const worker = new Worker(workerUrl);
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      const db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(workerUrl);
      // Best-effort OPFS persistence; falls back to in-memory if unavailable.
      try {
        await db.open({
          path: "opfs://weblog.db",
          accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
        });
      } catch {
        await db.open({});
      }
      return db;
    })();
  }
  return dbPromise;
}

/** Quote a SQL identifier safely. */
function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Escape a string literal for ILIKE. */
function likeLiteral(term: string): string {
  const escaped = term.replace(/'/g, "''").replace(/([%_\\])/g, "\\$1");
  return `'%${escaped}%'`;
}

function classifyType(type: string): ColumnMeta["kind"] {
  const t = type.toUpperCase();
  if (/INT|DECIMAL|DOUBLE|FLOAT|REAL|HUGEINT|NUMERIC/.test(t)) return "number";
  if (/BOOL/.test(t)) return "boolean";
  if (/TIMESTAMP|DATE|TIME/.test(t)) return "time";
  return "string";
}

let tableSeq = 0;

export interface IngestInput {
  buffer: Uint8Array;
  source: SourceKind;
  label: string;
  delimiter: string;
}

/** Register a normalized CSV buffer and build a queryable table. */
export async function ingest(input: IngestInput): Promise<DatasetMeta> {
  const db = await getDb();
  const conn = await db.connect();
  const started = performance.now();
  const table = `t_${++tableSeq}`;
  const virtualName = `${table}.csv`;
  // Capture size up front: registerFileBuffer may detach the ArrayBuffer.
  const bytes = input.buffer.byteLength;

  try {
    await db.registerFileBuffer(virtualName, input.buffer);

    // row_number() gives a stable ordering key and survives sorting/filtering.
    const readOpts =
      input.source === "tsv" ? ", delim='\\t'" : ", sample_size=-1";
    await conn.query(
      `CREATE TABLE ${ident(table)} AS
       SELECT row_number() OVER () AS ${ident(ROW_ID)}, *
       FROM read_csv_auto('${virtualName}', header=true${readOpts})`,
    );

    const describe = await conn.query(`DESCRIBE ${ident(table)}`);
    const columns: ColumnMeta[] = describe
      .toArray()
      .map((r) => {
        const name = String(r.column_name);
        const type = String(r.column_type);
        return { name, type, kind: classifyType(type) };
      })
      .filter((c) => !c.name.startsWith(INTERNAL_PREFIX));

    const countRes = await conn.query(
      `SELECT count(*)::BIGINT AS n FROM ${ident(table)}`,
    );
    const rowCount = Number(countRes.toArray()[0].n);

    await db.dropFile(virtualName).catch(() => {});

    return {
      table,
      label: input.label,
      source: input.source,
      columns,
      rowCount,
      bytes,
      ingestMs: performance.now() - started,
    };
  } finally {
    await conn.close();
  }
}

function buildWhere(spec: QuerySpec, columns: ColumnMeta[]): string {
  const term = spec.search.trim();
  if (!term) return "";
  // Search every visible column as text. ILIKE = case-insensitive.
  const clauses = columns
    .map(
      (c) =>
        `CAST(${ident(c.name)} AS VARCHAR) ILIKE ${likeLiteral(term)} ESCAPE '\\'`,
    )
    .join(" OR ");
  return clauses ? `WHERE (${clauses})` : "";
}

function buildOrder(spec: QuerySpec): string {
  if (spec.sort) {
    return `ORDER BY ${ident(spec.sort.column)} ${
      spec.sort.dir === "desc" ? "DESC" : "ASC"
    } NULLS LAST, ${ident(ROW_ID)} ASC`;
  }
  return `ORDER BY ${ident(ROW_ID)} ASC`;
}

/** Count rows matching the current search (for the virtual scroller height). */
export async function countMatching(
  spec: QuerySpec,
  columns: ColumnMeta[],
): Promise<number> {
  const db = await getDb();
  const conn = await db.connect();
  try {
    const where = buildWhere(spec, columns);
    const res = await conn.query(
      `SELECT count(*)::BIGINT AS n FROM ${ident(spec.table)} ${where}`,
    );
    return Number(res.toArray()[0].n);
  } finally {
    await conn.close();
  }
}

/**
 * Fetch a sorted/filtered window — only what the viewport needs.
 * Each returned row is `[__row_id, ...cellValues]`; the leading row id is the
 * stable key used for in-place cell edits.
 */
export async function fetchWindow(
  spec: QuerySpec,
  columns: ColumnMeta[],
  offset: number,
  limit: number,
): Promise<QueryResult> {
  const db = await getDb();
  const conn = await db.connect();
  const started = performance.now();
  try {
    const cols = columns.map((c) => ident(c.name)).join(", ");
    const where = buildWhere(spec, columns);
    const order = buildOrder(spec);
    const res = await conn.query(
      `SELECT ${ident(ROW_ID)}, ${cols} FROM ${ident(spec.table)} ${where} ${order}
       LIMIT ${limit} OFFSET ${offset}`,
    );
    return {
      rows: arrowToRows(res, columns.length + 1),
      elapsedMs: performance.now() - started,
    };
  } finally {
    await conn.close();
  }
}

/** SQL literal for a cell value, typed by the column's coarse kind. */
function cellLiteral(value: string, kind: ColumnMeta["kind"]): string {
  const v = value.trim();
  if (v === "") return "NULL";
  if (kind === "number") {
    return Number.isFinite(Number(v)) ? v : "NULL";
  }
  if (kind === "boolean") {
    if (/^(true|1|t|yes)$/i.test(v)) return "TRUE";
    if (/^(false|0|f|no)$/i.test(v)) return "FALSE";
    return "NULL";
  }
  const escaped = v.replace(/'/g, "''");
  if (kind === "time") return `TIMESTAMP '${escaped}'`;
  return `'${escaped}'`;
}

/**
 * Clear (set NULL) a rectangular selection of cells in one statement.
 * The row window respects the current sort/search so it matches what the user
 * sees, and works regardless of which pages are cached on the client.
 */
export async function clearCells(
  spec: QuerySpec,
  columns: ColumnMeta[],
  rowStart: number,
  rowEnd: number,
  colStart: number,
  colEnd: number,
): Promise<void> {
  const db = await getDb();
  const conn = await db.connect();
  try {
    const targetCols = columns.slice(colStart, colEnd + 1);
    if (targetCols.length === 0) return;
    const sets = targetCols
      .map((c) => `${ident(c.name)} = NULL`)
      .join(", ");
    const where = buildWhere(spec, columns);
    const order = buildOrder(spec);
    const limit = rowEnd - rowStart + 1;
    await conn.query(
      `UPDATE ${ident(spec.table)} SET ${sets}
       WHERE ${ident(ROW_ID)} IN (
         SELECT ${ident(ROW_ID)} FROM ${ident(spec.table)} ${where} ${order}
         LIMIT ${limit} OFFSET ${rowStart}
       )`,
    );
  } finally {
    await conn.close();
  }
}

/** Edit a single cell in place, keyed by its stable __row_id. */
export async function updateCell(
  table: string,
  rowId: number | bigint,
  column: ColumnMeta,
  value: string,
): Promise<void> {
  const db = await getDb();
  const conn = await db.connect();
  try {
    await conn.query(
      `UPDATE ${ident(table)} SET ${ident(column.name)} = ${cellLiteral(
        value,
        column.kind,
      )} WHERE ${ident(ROW_ID)} = ${rowId}`,
    );
  } finally {
    await conn.close();
  }
}

export interface SqlResult {
  columns: string[];
  rows: unknown[][];
  elapsedMs: number;
  rowCount: number;
}

/** REPL: run arbitrary SQL and return a tabular result. */
export async function runSql(sql: string): Promise<SqlResult> {
  const db = await getDb();
  const conn = await db.connect();
  const started = performance.now();
  try {
    const res = await conn.query(sql);
    const cols = res.schema.fields.map((f) => f.name);
    const rows = arrowToRows(res, cols.length);
    return {
      columns: cols,
      rows,
      elapsedMs: performance.now() - started,
      rowCount: rows.length,
    };
  } finally {
    await conn.close();
  }
}

/** List user tables for the REPL schema panel. */
export async function listTables(): Promise<string[]> {
  const db = await getDb();
  const conn = await db.connect();
  try {
    const res = await conn.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'main' ORDER BY table_name`,
    );
    return res.toArray().map((r) => String(r.table_name));
  } finally {
    await conn.close();
  }
}

/** Columnar extraction — fastest path out of an Arrow result. */
function arrowToRows(
  // deno-lint-ignore no-explicit-any
  table: { numRows: number; getChildAt: (i: number) => any },
  width: number,
): unknown[][] {
  const n = table.numRows;
  const cols = Array.from({ length: width }, (_, c) => table.getChildAt(c));
  const rows: unknown[][] = new Array(n);
  for (let r = 0; r < n; r++) {
    const row = new Array(width);
    for (let c = 0; c < width; c++) {
      row[c] = cols[c]?.get(r) ?? null;
    }
    rows[r] = row;
  }
  return rows;
}
