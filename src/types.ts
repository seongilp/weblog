/** Shared domain types across workers, db layer, and UI. */

export type SourceKind = "csv" | "tsv" | "xlsx" | "log" | "json";

export type ColumnType =
  | "VARCHAR"
  | "BIGINT"
  | "DOUBLE"
  | "BOOLEAN"
  | "TIMESTAMP"
  | "DATE";

export interface ColumnMeta {
  name: string;
  /** DuckDB type as reported by DESCRIBE. */
  type: string;
  /** Coarse category used for rendering / filter UI. */
  kind: "number" | "string" | "boolean" | "time";
}

export interface DatasetMeta {
  /** SQL-safe table name inside DuckDB. */
  table: string;
  /** Original file name shown in the UI. */
  label: string;
  source: SourceKind;
  columns: ColumnMeta[];
  rowCount: number;
  bytes: number;
  /** ms spent parsing + loading into DuckDB. */
  ingestMs: number;
}

export type SortDir = "asc" | "desc";

export interface SortSpec {
  column: string;
  dir: SortDir;
}

export interface QuerySpec {
  table: string;
  /** Free-text search across all columns (case-insensitive substring). */
  search: string;
  sort: SortSpec | null;
}

export interface RowPage {
  offset: number;
  rows: unknown[][];
}

export interface QueryResult {
  rows: unknown[][];
  /** ms the DuckDB query itself took. */
  elapsedMs: number;
}

/* ---- parse worker protocol ---- */

export interface ParseRequest {
  id: number;
  file: File;
  /** Optional log grok-ish pattern hint, reserved for future use. */
  logPattern?: string;
}

export interface ParseProgress {
  id: number;
  type: "progress";
  phase: string;
  /** 0..1 if known. */
  ratio?: number;
}

export interface ParseDone {
  id: number;
  type: "done";
  /** Normalized CSV bytes ready to register into DuckDB. */
  buffer: Uint8Array;
  source: SourceKind;
  /** Detected sheet names (xlsx) for informational display. */
  sheets?: string[];
  delimiter: string;
  bytes: number;
}

export interface ParseError {
  id: number;
  type: "error";
  message: string;
}

export type ParseResponse = ParseProgress | ParseDone | ParseError;
