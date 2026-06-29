import { useState } from "react";
import {
  Layers,
  Table2,
  Terminal,
  Plus,
  Loader2,
  FileWarning,
} from "lucide-react";
import { useIngest } from "@/hooks/useIngest";
import { Landing } from "@/features/landing/Landing";
import { Workspace } from "@/features/table/Workspace";
import { Repl } from "@/features/repl/Repl";
import { FileDropzone } from "@/features/ingest/FileDropzone";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatCount, formatDuration } from "@/lib/utils";

const SAMPLE_SIZE = 1_000_000;

export default function App() {
  const ingest = useIngest();
  const { status, dataset, progress, error } = ingest;

  if (status !== "ready" || !dataset) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="relative min-h-full">
          <Landing
            onLoadSample={() => ingest.loadSample(SAMPLE_SIZE)}
            onFile={ingest.loadFile}
            busy={status === "busy"}
          />
          {status === "busy" && progress && (
            <LoadingOverlay phase={progress.phase} ratio={progress.ratio} />
          )}
          {status === "error" && error && (
            <div className="fixed bottom-6 left-1/2 z-50 flex max-w-lg -translate-x-1/2 items-start gap-2 rounded-lg border border-destructive/50 bg-card px-4 py-3 text-sm text-destructive-foreground shadow-xl">
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Could not load that file</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {error}
                </p>
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Ready ingest={ingest} dataset={dataset} />
    </TooltipProvider>
  );
}

function Ready({
  ingest,
  dataset,
}: {
  ingest: ReturnType<typeof useIngest>;
  dataset: NonNullable<ReturnType<typeof useIngest>["dataset"]>;
}) {
  const [tab, setTab] = useState("table");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <span className="font-mono text-sm font-semibold tracking-tight">
            weblog
          </span>
        </div>

        <div className="mx-1 h-5 w-px bg-border" />

        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {dataset.label}
          </span>
          <Badge variant="muted" className="uppercase">
            {dataset.source}
          </Badge>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            {formatCount(dataset.rowCount)} rows · {dataset.columns.length} cols
          </Badge>
          <Badge variant="outline">{formatBytes(dataset.bytes)}</Badge>
          <Badge variant="outline" title="Parse + load time">
            ingest {formatDuration(dataset.ingestMs)}
          </Badge>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="table">
                <Table2 className="h-3.5 w-3.5" /> Table
              </TabsTrigger>
              <TabsTrigger value="repl">
                <Terminal className="h-3.5 w-3.5" /> SQL
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={ingest.reset}>
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>
      </header>

      {/* Body */}
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col p-4"
      >
        <TabsContent
          value="table"
          className="m-0 min-h-0 flex-1 data-[state=inactive]:hidden"
        >
          <Workspace dataset={dataset} />
        </TabsContent>
        <TabsContent
          value="repl"
          className="m-0 min-h-0 flex-1 data-[state=inactive]:hidden"
        >
          <Repl defaultTable={dataset.table} />
        </TabsContent>
      </Tabs>

      {/* Persistent dropzone to swap in another file */}
      <div className="shrink-0 border-t border-border px-4 py-2">
        <FileDropzone onFile={ingest.loadFile} compact />
      </div>
    </div>
  );
}

function LoadingOverlay({ phase, ratio }: { phase: string; ratio?: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex w-80 flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="w-full text-center">
          <p className="text-sm font-medium text-foreground">{phase}…</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-150"
              style={{
                width:
                  ratio !== undefined ? `${Math.round(ratio * 100)}%` : "40%",
              }}
            />
          </div>
          {ratio !== undefined && (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {Math.round(ratio * 100)}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
