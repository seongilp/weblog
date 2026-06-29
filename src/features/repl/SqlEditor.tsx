import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL, type SQLNamespace } from "@codemirror/lang-sql";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  /** table name -> column names, for schema-aware autocompletion. */
  schema: SQLNamespace;
  defaultTable?: string;
}

// Slate-flavored editor chrome: transparent background, mono font, themed popups.
const slateTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "var(--foreground)",
      fontSize: "13px",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-content": {
      fontFamily: "var(--font-mono)",
      caretColor: "var(--foreground)",
      padding: "10px 0",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      border: "none",
      color: "color-mix(in oklch, var(--muted-foreground) 60%, transparent)",
    },
    ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor: "color-mix(in oklch, var(--secondary) 25%, transparent)",
    },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "color-mix(in oklch, var(--ring) 35%, transparent)",
    },
    ".cm-cursor": { borderLeftColor: "var(--foreground)" },
    ".cm-tooltip": {
      backgroundColor: "var(--popover)",
      border: "1px solid var(--border)",
      borderRadius: "8px",
      overflow: "hidden",
      color: "var(--foreground)",
    },
    ".cm-tooltip-autocomplete > ul > li": {
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
      padding: "3px 8px",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--secondary)",
      color: "var(--foreground)",
    },
    ".cm-completionIcon": { opacity: "0.6" },
  },
  { dark: true },
);

const slateHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#c4b5fd", fontWeight: "600" },
  { tag: [t.string, t.special(t.string)], color: "#86efac" },
  { tag: t.number, color: "#fca5a5" },
  { tag: t.bool, color: "#fca5a5" },
  { tag: t.null, color: "#fca5a5" },
  { tag: t.comment, color: "var(--muted-foreground)", fontStyle: "italic" },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: "#7dd3fc",
  },
  { tag: t.operator, color: "var(--muted-foreground)" },
  { tag: t.punctuation, color: "var(--muted-foreground)" },
]);

export function SqlEditor({
  value,
  onChange,
  onRun,
  schema,
  defaultTable,
}: SqlEditorProps) {
  const extensions = useMemo(
    () => [
      sql({
        dialect: PostgreSQL,
        schema,
        defaultTable,
        upperCaseKeywords: true,
      }),
      slateTheme,
      syntaxHighlighting(slateHighlight),
      EditorView.lineWrapping,
      // Cmd/Ctrl+Enter runs; highest precedence so it beats default bindings.
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onRun();
              return true;
            },
          },
        ]),
      ),
    ],
    [schema, defaultTable, onRun],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      height="160px"
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        autocompletion: true,
        bracketMatching: true,
        closeBrackets: true,
        searchKeymap: false,
      }}
    />
  );
}
