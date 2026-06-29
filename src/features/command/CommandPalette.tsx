import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
  disabled?: boolean;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
}

export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = commands.filter((c) => !c.disabled);
    if (!q) return list;
    return list.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.hint?.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // focus after mount
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const run = (cmd?: Command) => {
    if (!cmd) return;
    onOpenChange(false);
    cmd.run();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-background/70 backdrop-blur-sm pt-[18vh]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command…"
            className="h-11 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(filtered[active]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onOpenChange(false);
              }
            }}
          />
        </div>
        <ul className="max-h-80 overflow-auto p-1.5">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matching commands
            </li>
          )}
          {filtered.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => run(cmd)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm",
                  i === active
                    ? "bg-secondary text-foreground"
                    : "text-foreground/80",
                )}
              >
                <cmd.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{cmd.label}</span>
                {cmd.hint && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {cmd.hint}
                  </span>
                )}
                {i === active && (
                  <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
