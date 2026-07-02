import { useCallback, useState } from "react";
import type { DatasetMeta } from "@/types";
import { ingest } from "@/duckdb/db";
import { parseFile } from "@/workers/parseClient";
import { generateSample } from "@/workers/sampleClient";

export type IngestStatus = "idle" | "busy" | "ready" | "error";

export interface IngestProgress {
  phase: string;
  ratio?: number;
}

export interface IngestState {
  status: IngestStatus;
  progress: IngestProgress | null;
  error: string | null;
  dataset: DatasetMeta | null;
}

export function useIngest() {
  const [state, setState] = useState<IngestState>({
    status: "idle",
    progress: null,
    error: null,
    dataset: null,
  });

  const reset = useCallback(() => {
    setState({ status: "idle", progress: null, error: null, dataset: null });
  }, []);

  const loadFile = useCallback(async (file: File) => {
    // Keep the current dataset visible while the new one loads.
    setState((s) => ({
      ...s,
      status: "busy",
      progress: { phase: "Starting" },
      error: null,
    }));
    try {
      const parsed = await parseFile(file, {
        onProgress: (phase, ratio) =>
          setState((s) => ({ ...s, progress: { phase, ratio } })),
      });
      setState((s) => ({
        ...s,
        progress: { phase: "Loading into DuckDB" },
      }));
      const dataset = await ingest({
        buffer: parsed.buffer,
        source: parsed.source,
        label: file.name,
        delimiter: parsed.delimiter,
      });
      setState({ status: "ready", progress: null, error: null, dataset });
    } catch (err) {
      // On failure, keep the previous dataset if there was one.
      setState((s) => ({
        ...s,
        status: s.dataset ? "ready" : "error",
        progress: null,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const loadSample = useCallback(async (count: number) => {
    setState((s) => ({
      ...s,
      status: "busy",
      progress: { phase: `Generating ${count.toLocaleString()} log lines` },
      error: null,
    }));
    try {
      const buffer = await generateSample(count, (ratio) =>
        setState((s) => ({
          ...s,
          progress: { phase: "Generating sample logs", ratio },
        })),
      );
      setState((s) => ({ ...s, progress: { phase: "Loading into DuckDB" } }));
      const dataset = await ingest({
        buffer,
        source: "log",
        label: `${count.toLocaleString()} sample logs`,
        delimiter: ",",
      });
      setState({ status: "ready", progress: null, error: null, dataset });
    } catch (err) {
      setState((s) => ({
        ...s,
        status: s.dataset ? "ready" : "error",
        progress: null,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  return { ...state, loadFile, loadSample, reset };
}
