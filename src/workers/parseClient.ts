import type { ParseDone, ParseRequest, ParseResponse } from "@/types";

/*
 * Thin promise wrapper around the parse worker. One worker is reused across
 * uploads; each request gets a monotonic id so responses can be routed.
 */

let worker: Worker | null = null;
let seq = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./parse.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

export interface ParseOptions {
  onProgress?: (phase: string, ratio?: number) => void;
}

export function parseFile(
  file: File,
  opts: ParseOptions = {},
): Promise<ParseDone> {
  const w = getWorker();
  const id = ++seq;
  return new Promise<ParseDone>((resolve, reject) => {
    const handler = (e: MessageEvent<ParseResponse>) => {
      const msg = e.data;
      if (msg.id !== id) return;
      if (msg.type === "progress") {
        opts.onProgress?.(msg.phase, msg.ratio);
      } else if (msg.type === "done") {
        w.removeEventListener("message", handler);
        resolve(msg);
      } else {
        w.removeEventListener("message", handler);
        reject(new Error(msg.message));
      }
    };
    w.addEventListener("message", handler);
    const req: ParseRequest = { id, file };
    w.postMessage(req);
  });
}
