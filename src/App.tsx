import { useEffect, useRef, useState } from "react";
import {
  Layers,
  Table2,
  Terminal,
  Plus,
  Loader2,
  FileWarning,
  FolderOpen,
  Zap,
  UploadCloud,
  Command as CommandIcon,
} from "lucide-react";
import { useIngest } from "@/hooks/useIngest";
import { useGlobalDrop } from "@/hooks/useGlobalDrop";
import { Landing } from "@/features/landing/Landing";
import { Workspace } from "@/features/table/Workspace";
import { Repl } from "@/features/repl/Repl";
import { CommandPalette, type Command } from "@/features/command/CommandPalette";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatCount, formatDuration } from "@/lib/utils";

const SAMPLE_SIZE = 1_000_000;
const ACCEPT = ".csv,.tsv,.xlsx,.xls,.log,.txt,.json,.ndjson";

export default function App() {
  const ingest = useIngest();
  const { status, dataset, progress, error } = ingest;
  const [tab, setTab] = useState("table");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = status === "busy";
  const isDragging = useGlobalDrop(ingest.loadFile, !busy);

  // Global Cmd/Ctrl+K opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openFile = () => fileInputRef.current?.click();

  const commands: Command[] = [
    {
      id: "sample",
      label: "Load 1,000,000 sample logs",
      hint: "demo",
      icon: Zap,
      run: () => ingest.loadSample(SAMPLE_SIZE),
    },
    { id: "open", label: "Open a file…", icon: FolderOpen, run: openFile },
    {
      id: "table",
      label: "Switch to Table view",
      icon: Table2,
      run: () => setTab("table"),
      disabled: !dataset,
    },
    {
      id: "sql",
      label: "Switch to SQL REPL",
      icon: Terminal,
      run: () => setTab("repl"),
      disabled: !dataset,
    },
    {
      id: "new",
      label: "Close dataset / start over",
      icon: Plus,
      run: ingest.reset,
      disabled: !dataset,
    },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      {/* hidden input powering the "Open a file" command */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) ingest.loadFile(f);
          e.target.value = "";
        }}
      />

      {status !== "ready" || !dataset ? (
        <div className="relative min-h-full">
          <Landing
            onLoadSample={() => ingest.loadSample(SAMPLE_SIZE)}
            onFile={ingest.loadFile}
            busy={busy}
          />
          {status === "error" && error && <ErrorToast error={error} />}
        </div>
      ) : (
        <Ready
          ingest={ingest}
          dataset={dataset}
          tab={tab}
          setTab={setTab}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      )}

      {busy && progress && (
        <LoadingOverlay phase={progress.phase} ratio={progress.ratio} />
      )}
      {isDragging && <DropOverlay />}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={commands}
      />
    </TooltipProvider>
  );
}

function Ready({
  ingest,
  dataset,
  tab,
  setTab,
  onOpenPalette,
}: {
  ingest: ReturnType<typeof useIngest>;
  dataset: NonNullable<ReturnType<typeof useIngest>["dataset"]>;
  tab: string;
  setTab: (t: string) => void;
  onOpenPalette: () => void;
}) {
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
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenPalette}
            title="Command palette (⌘/Ctrl + K)"
          >
            <CommandIcon className="h-3.5 w-3.5" /> K
          </Button>
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
    </div>
  );
}

function ErrorToast({ error }: { error: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex max-w-lg -translate-x-1/2 items-start gap-2 rounded-lg border border-destructive/50 bg-card px-4 py-3 text-sm text-destructive-foreground shadow-xl">
      <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">Could not load that file</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{error}</p>
      </div>
    </div>
  );
}

function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center bg-primary/10 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-card/90 px-12 py-10 shadow-2xl">
        <UploadCloud className="h-10 w-10 text-primary" />
        <p className="text-base font-semibold text-foreground">
          Drop to open anywhere
        </p>
        <p className="text-xs text-muted-foreground">
          CSV · TSV · XLSX · LOG · JSON
        </p>
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
