import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = ".csv,.tsv,.xlsx,.xls,.log,.txt,.json,.ndjson";

type Size = "default" | "compact" | "large";

interface FileDropzoneProps {
  onFile: (file: File) => void;
  /** Visual size. `large` is the primary call-to-action on the landing page. */
  size?: Size;
  compact?: boolean;
  disabled?: boolean;
  mainText?: string;
  hintText?: string;
}

export function FileDropzone({
  onFile,
  size,
  compact,
  disabled,
  mainText = "Drop a file or click to browse",
  hintText = "CSV · TSV · XLSX · LOG · JSON — parsed locally, never uploaded",
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const resolved: Size = compact ? "compact" : (size ?? "default");

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
        "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card/30 text-center transition-colors",
        "hover:border-primary/70 hover:bg-primary/5",
        dragging && "border-primary bg-primary/10",
        disabled && "pointer-events-none opacity-50",
        resolved === "compact" && "px-4 py-3",
        resolved === "default" && "px-8 py-12",
        resolved === "large" && "gap-3 px-8 py-20",
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
        className={cn(
          "text-muted-foreground transition-colors group-hover:text-primary",
          resolved === "compact" && "h-5 w-5",
          resolved === "default" && "h-9 w-9",
          resolved === "large" && "h-14 w-14",
        )}
      />
      {resolved === "compact" ? (
        <span className="text-xs text-muted-foreground">{mainText}</span>
      ) : (
        <>
          <p
            className={cn(
              "font-medium text-foreground",
              resolved === "large" ? "text-lg" : "text-sm",
            )}
          >
            {mainText}
          </p>
          <p
            className={cn(
              "text-muted-foreground",
              resolved === "large" ? "text-sm" : "text-xs",
            )}
          >
            {hintText}
          </p>
        </>
      )}
    </div>
  );
}
