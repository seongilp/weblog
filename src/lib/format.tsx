import type { ColumnMeta } from "@/types";

/** Render a raw DuckDB/Arrow cell value into display text. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * DuckDB TIMESTAMP/DATE columns arrive through Arrow as epoch numbers.
 * Render them as ISO text; fall back to the raw value if it isn't a timestamp.
 */
export function timeCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "bigint") {
    const d = new Date(Number(value));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return cellText(value);
}

/** Map a log level string onto a semantic color class. */
export function levelClass(level: string): string {
  switch (level.toUpperCase()) {
    case "ERROR":
    case "FATAL":
    case "CRITICAL":
      return "text-destructive-foreground bg-destructive/20";
    case "WARN":
    case "WARNING":
    case "NOTICE":
      return "text-warning bg-warning/15";
    case "INFO":
      return "text-success bg-success/10";
    case "DEBUG":
    case "TRACE":
      return "text-muted-foreground bg-muted/30";
    default:
      return "text-muted-foreground";
  }
}

export function isLevelColumn(col: ColumnMeta): boolean {
  return col.name.toLowerCase() === "level";
}

export function alignClass(col: ColumnMeta): string {
  return col.kind === "number" ? "text-right tabular-nums" : "text-left";
}
