import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = ".csv,.tsv,.xlsx,.xls,.log,.txt,.json,.ndjson";

interface FileDropzoneProps {
  onFile: (file: File) => void;
  compact?: boolean;
  disabled?: boolean;
  mainText?: string;
  hintText?: string;
}

export function FileDropzone({
  onFile,
  compact,
  disabled,
  mainText = "Drop a file or click to browse",
  hintText = "CSV · TSV · XLSX · LOG · JSON — parsed locally, never uploaded",
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card/30 text-center transition-colors",
        "hover:border-ring/60 hover:bg-card/50",
        dragging && "border-primary bg-primary/5",
        disabled && "pointer-events-none opacity-50",
        compact ? "px-4 py-3" : "px-8 py-12",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <UploadCloud
        className={cn("text-muted-foreground", compact ? "h-5 w-5" : "h-9 w-9")}
      />
      {compact ? (
        <span className="text-xs text-muted-foreground">{mainText}</span>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">{mainText}</p>
          <p className="text-xs text-muted-foreground">{hintText}</p>
        </>
      )}
    </div>
  );
}
