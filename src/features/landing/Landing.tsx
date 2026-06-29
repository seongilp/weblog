import { useState } from "react";
import {
  Zap,
  Database,
  Cpu,
  HardDrive,
  Table2,
  FileSpreadsheet,
  ScrollText,
  Braces,
  ArrowRight,
  Languages,
} from "lucide-react";
import { FileDropzone } from "@/features/ingest/FileDropzone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Lang = "ko" | "en";

interface LandingProps {
  onLoadSample: () => void;
  onFile: (file: File) => void;
  busy: boolean;
}

const COPY = {
  ko: {
    tag: "서버리스 · 100% 클라이언트",
    title1: "로그 100만 줄,",
    title2: "밀리초 안에 정렬·검색.",
    lead: (
      <>
        <span className="font-mono text-foreground">weblog</span> 는{" "}
        <strong className="font-semibold text-foreground">
          로그 파일이든 엑셀(XLSX)이든 CSV든
        </strong>{" "}
        브라우저 안의 DuckDB로 불러와 즉시 검색, 컬럼 정렬, SQL REPL 로 잘라보는
        정적 페이지입니다.
      </>
    ),
    formatsHeading: "로그 · 엑셀 · CSV — 무엇이든 끌어다 놓으면 됩니다",
    formats: [
      { icon: ScrollText, label: "로그 / TXT", desc: "타임스탬프·레벨 자동 추출" },
      { icon: Table2, label: "CSV / TSV", desc: "구분자 자동 감지" },
      { icon: FileSpreadsheet, label: "엑셀 XLSX", desc: "시트를 표로 평탄화" },
      { icon: Braces, label: "JSON / NDJSON", desc: "줄 단위 레코드" },
    ],
    cta: "로그 1,000,000건 불러오기",
    ctaSub: "합성 로그 100만 줄을 만들어 바로 도구에 띄웁니다 — 파일 필요 없음.",
    features: [
      {
        icon: Database,
        title: "DuckDB-Wasm 엔진",
        body: "브라우저 탭 안에서 도는 진짜 컬럼형 SQL 엔진. 서버도, 업로드도 없음.",
      },
      {
        icon: HardDrive,
        title: "OPFS 영속화",
        body: "데이터셋은 Origin Private File System 에 저장되어 새로고침해도 유지됩니다.",
      },
      {
        icon: Cpu,
        title: "워커 기반 파싱",
        body: "CSV·XLSX·로그 파싱을 메인 스레드 밖에서 처리 — 화면이 멈추지 않음.",
      },
      {
        icon: Table2,
        title: "윈도잉 가상 스크롤",
        body: "보이는 행만 렌더링. 100만 줄을 100줄처럼 스크롤합니다.",
      },
    ],
    footer:
      "React · DuckDB-Wasm · Tailwind · shadcn/ui 로 제작 — 데이터는 브라우저를 떠나지 않습니다.",
    dropHint: "CSV · TSV · XLSX · LOG · JSON — 로컬에서 파싱, 업로드 없음",
    dropMain: "파일을 끌어다 놓거나 클릭해서 선택",
  },
  en: {
    tag: "Serverless · 100% client-side",
    title1: "A million log lines.",
    title2: "Sorted & searched in milliseconds.",
    lead: (
      <>
        <span className="font-mono text-foreground">weblog</span> loads{" "}
        <strong className="font-semibold text-foreground">
          log files, Excel (XLSX) and CSV alike
        </strong>{" "}
        into an in-browser DuckDB, then lets you slice them with instant search,
        sortable columns, and a SQL REPL.
      </>
    ),
    formatsHeading: "Logs · Excel · CSV — drop in anything tabular",
    formats: [
      { icon: ScrollText, label: "Logs / TXT", desc: "Auto timestamp & level" },
      { icon: Table2, label: "CSV / TSV", desc: "Delimiter auto-detect" },
      { icon: FileSpreadsheet, label: "Excel XLSX", desc: "Sheets flattened to a table" },
      { icon: Braces, label: "JSON / NDJSON", desc: "Line-delimited records" },
    ],
    cta: "Load 1,000,000 sample logs",
    ctaSub:
      "Generates a million synthetic log rows and opens them in the tool — no file needed.",
    features: [
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
    ],
    footer:
      "Built with React · DuckDB-Wasm · Tailwind · shadcn/ui — your data never leaves the browser.",
    dropHint: "CSV · TSV · XLSX · LOG · JSON — parsed locally, never uploaded",
    dropMain: "Drop a file or click to browse",
  },
} satisfies Record<Lang, unknown>;

export function Landing({ onLoadSample, onFile, busy }: LandingProps) {
  // Korean is the default; visitors can switch to English with the toggle.
  const [lang, setLang] = useState<Lang>("ko");
  const t = COPY[lang];

  return (
    <div className="relative mx-auto flex min-h-full max-w-5xl flex-col items-center px-6 py-16">
      {/* Language toggle */}
      <div className="absolute right-6 top-6 flex items-center overflow-hidden rounded-md border border-border bg-card/40 text-xs">
        <Languages className="mx-2 h-3.5 w-3.5 text-muted-foreground" />
        {(["ko", "en"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-2.5 py-1.5 font-medium uppercase transition-colors ${
              lang === l
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {l === "ko" ? "한국어" : "EN"}
          </button>
        ))}
      </div>

      <Badge variant="outline" className="mb-6 gap-1.5">
        <Zap className="h-3.5 w-3.5 text-primary" />
        {t.tag}
      </Badge>

      <h1 className="text-center text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        {t.title1}
        <br />
        <span className="bg-gradient-to-r from-sky-300 via-blue-400 to-blue-500 bg-clip-text text-transparent">
          {t.title2}
        </span>
      </h1>
      <p className="mt-5 max-w-2xl text-center text-base text-muted-foreground">
        {t.lead}
      </p>

      {/* Primary CTA */}
      <div className="mt-9 flex flex-col items-center gap-3">
        <Button
          size="lg"
          variant="primary"
          onClick={onLoadSample}
          disabled={busy}
          className="h-12 px-7 text-base shadow-lg shadow-primary/35"
        >
          <Zap className="h-5 w-5" />
          {t.cta}
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground/70">{t.ctaSub}</p>
      </div>

      {/* Formats — emphasized: logs, Excel, CSV, anything tabular */}
      <div className="mt-10 w-full max-w-3xl rounded-xl border border-border bg-card/40 p-5">
        <p className="mb-4 text-center text-sm font-semibold text-foreground">
          {t.formatsHeading}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {t.formats.map((f) => (
            <div
              key={f.label}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/20 px-3 py-4 text-center"
            >
              <f.icon className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {f.label}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {f.desc}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Dropzone */}
      <div className="mt-10 w-full max-w-xl">
        <FileDropzone
          onFile={onFile}
          disabled={busy}
          mainText={t.dropMain}
          hintText={t.dropHint}
        />
      </div>

      {/* Feature grid */}
      <div className="mt-16 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {t.features.map((f) => (
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
        {t.footer}
      </footer>
    </div>
  );
}
