import {
  Zap,
  Database,
  Cpu,
  HardDrive,
  Table2,
  Terminal,
  FileSpreadsheet,
  ScrollText,
  ArrowRight,
} from "lucide-react";
import { FileDropzone } from "@/features/ingest/FileDropzone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LandingProps {
  onLoadSample: () => void;
  onFile: (file: File) => void;
  busy: boolean;
}

const FEATURES = [
  {
    icon: Database,
    title: "DuckDB-Wasm engine",
    body: "A real columnar SQL engine in your browser tab. No server, no upload.",
  },
  {
    icon: HardDrive,
    title: "OPFS persistence",
    body: "Datasets live in the Origin Private File System and survive reloads.",
  },
  {
    icon: Cpu,
    title: "Workers for parsing",
    body: "CSV, XLSX and log parsing run off the main thread — the UI never janks.",
  },
  {
    icon: Table2,
    title: "Windowed virtual scroll",
    body: "Render only the visible rows; scroll a million as if it were a hundred.",
  },
];

const FORMATS = [
  { icon: ScrollText, label: ".log / .txt" },
  { icon: Table2, label: ".csv / .tsv" },
  { icon: FileSpreadsheet, label: ".xlsx" },
  { icon: Terminal, label: "SQL REPL" },
];

export function Landing({ onLoadSample, onFile, busy }: LandingProps) {
  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col items-center px-6 py-16">
      <Badge variant="outline" className="mb-6 gap-1.5">
        <Zap className="h-3.5 w-3.5 text-primary" />
        Serverless · 100% client-side
      </Badge>

      <h1 className="text-center text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        A million log lines.
        <br />
        <span className="bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent">
          Sorted & searched in milliseconds.
        </span>
      </h1>
      <p className="mt-5 max-w-2xl text-center text-base text-muted-foreground">
        <span className="font-mono text-foreground">weblog</span> is a static page
        that loads logs, CSV and XLSX into an in-browser DuckDB, then lets you
        slice them with instant search, sortable columns, and a SQL REPL.
      </p>

      {/* Primary CTA */}
      <div className="mt-9 flex flex-col items-center gap-3">
        <Button
          size="lg"
          variant="primary"
          onClick={onLoadSample}
          disabled={busy}
          className="h-12 px-7 text-base shadow-lg shadow-black/30"
        >
          <Zap className="h-5 w-5" />
          Load 1,000,000 sample logs
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground/70">
          Generates a million synthetic log rows and opens them in the tool — no
          file needed.
        </p>
      </div>

      {/* Formats */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {FORMATS.map((f) => (
          <Badge key={f.label} variant="muted" className="gap-1.5 px-3 py-1">
            <f.icon className="h-3.5 w-3.5" />
            {f.label}
          </Badge>
        ))}
      </div>

      {/* Dropzone */}
      <div className="mt-10 w-full max-w-xl">
        <FileDropzone onFile={onFile} disabled={busy} />
      </div>

      {/* Feature grid */}
      <div className="mt-16 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-border bg-card/40 p-4 text-left"
          >
            <f.icon className="mb-3 h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {f.body}
            </p>
          </div>
        ))}
      </div>

      <footer className="mt-16 text-center text-xs text-muted-foreground/60">
        Built with React · DuckDB-Wasm · Tailwind · shadcn/ui — your data never
        leaves the browser.
      </footer>
    </div>
  );
}
