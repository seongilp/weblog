import type {
  SampleRequest,
  SampleResponse,
} from "./sample.worker";

/** Generate N synthetic log rows as a CSV buffer, off the main thread. */
export function generateSample(
  count: number,
  onProgress?: (ratio: number) => void,
): Promise<Uint8Array> {
  const worker = new Worker(new URL("./sample.worker.ts", import.meta.url), {
    type: "module",
  });
  return new Promise<Uint8Array>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<SampleResponse>) => {
      const msg = e.data;
      if (msg.type === "progress") onProgress?.(msg.ratio);
      else if (msg.type === "done") {
        resolve(msg.buffer);
        worker.terminate();
      } else {
        reject(new Error(msg.message));
        worker.terminate();
      }
    };
    worker.onerror = (err) => {
      reject(new Error(err.message));
      worker.terminate();
    };
    const req: SampleRequest = { count };
    worker.postMessage(req);
  });
}
