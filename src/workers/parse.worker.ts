/// <reference lib="webworker" />
import * as XLSX from "xlsx";
import type {
  ParseRequest,
  ParseResponse,
  SourceKind,
} from "@/types";

/*
 * Parse worker: turns any uploaded File into a normalized CSV byte buffer that
 * DuckDB can ingest with read_csv_auto. All CPU-heavy work (xlsx inflate,
 * log regex extraction) happens here so the UI thread never janks.
 */

const post = (msg: ParseResponse, transfer?: Transferable[]) =>
  (self as DedicatedWorkerGlobalScope).postMessage(msg, transfer ?? []);

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const { id, file } = e.data;
  try {
    const source = detectKind(file);
    post({ id, type: "progress", phase: `Reading ${file.name}` });

    let buffer: Uint8Array;
    let delimiter = ",";
    let sheets: string[] | undefined;

    if (source === "xlsx") {
      const result = await parseXlsx(id, file);
      buffer = result.buffer;
      sheets = result.sheets;
    } else if (source === "log") {
      buffer = await parseLog(id, file);
    } else {
      // csv / tsv / json-lines: hand the raw bytes to DuckDB's sniffer.
      delimiter = source === "tsv" ? "\t" : ",";
      const ab = await file.arrayBuffer();
      buffer = new Uint8Array(ab);
    }

    post(
      {
        id,
        type: "done",
        buffer,
        source,
        sheets,
        delimiter,
        bytes: buffer.byteLength,
      },
      [buffer.buffer],
    );
  } catch (err) {
    post({
      id,
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

function detectKind(file: File): SourceKind {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "xlsx";
  if (name.endsWith(".tsv")) return "tsv";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".json") || name.endsWith(".ndjson")) return "json";
  if (name.endsWith(".log") || name.endsWith(".txt")) return "log";
  // Unknown extension: assume delimited text; the sniffer sorts it out.
  return "csv";
}

async function parseXlsx(
  id: number,
  file: File,
): Promise<{ buffer: Uint8Array; sheets: string[] }> {
  post({ id, type: "progress", phase: "Decoding workbook" });
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(ab), { type: "array" });
  const sheets = wb.SheetNames;
  const first = sheets[0];
  if (!first) throw new Error("Workbook has no sheets");
  post({ id, type: "progress", phase: `Flattening sheet "${first}"` });
  const sheet = wb.Sheets[first];
  // sheet_to_csv produces RFC-4180 compliant, properly escaped CSV.
  const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
  return { buffer: new TextEncoder().encode(csv), sheets };
}

const TS_RE =
  /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)|(\d{2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2})|([A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/;
const LEVEL_RE = /\b(TRACE|DEBUG|INFO|NOTICE|WARN(?:ING)?|ERROR|FATAL|CRITICAL)\b/i;

async function parseLog(id: number, file: File): Promise<Uint8Array> {
  post({ id, type: "progress", phase: "Splitting log lines" });
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const total = lines.length;

  const out: string[] = ["line_no,timestamp,level,message"];
  for (let i = 0; i < total; i++) {
    const raw = lines[i];
    if (raw.length === 0 && i === total - 1) continue; // trailing newline
    const ts = TS_RE.exec(raw)?.[0] ?? "";
    const lvl = LEVEL_RE.exec(raw)?.[1]?.toUpperCase() ?? "";
    out.push(
      `${i + 1},${csvField(ts)},${csvField(lvl)},${csvField(raw)}`,
    );
    if ((i & 0x3ffff) === 0 && total > 0) {
      post({ id, type: "progress", phase: "Parsing log", ratio: i / total });
    }
  }
  return new TextEncoder().encode(out.join("\n"));
}

/** RFC-4180 field escaping. */
function csvField(value: string): string {
  if (value === "") return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
