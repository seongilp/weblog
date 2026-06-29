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
      // Bright default so untagged identifiers (table names, aliases) stay legible.
      color: "#e2e8f0",
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

// NOTE: HighlightStyle colors must be literal hex/rgb — CSS var()/color-mix
// do not resolve here (unlike EditorView.theme), so identifiers would fall
// back to a dim default if we used them.
const slateHighlight = HighlightStyle.define([
  // Keywords: the theme's blue, the brightest accent in the editor.
  {
    tag: [t.keyword, t.modifier, t.operatorKeyword],
    color: "#6aa1ff",
    fontWeight: "600",
  },
  // Identifiers (columns, tables, aliases): bright, easy to read.
  {
    tag: [t.name, t.variableName, t.propertyName, t.attributeName, t.labelName],
    color: "#e2e8f0",
  },
  // Function names + types: sky.
  {
    tag: [
      t.function(t.variableName),
      t.function(t.propertyName),
      t.standard(t.name),
      t.typeName,
    ],
    color: "#38bdf8",
  },
  // Strings: calm teal.
  { tag: [t.string, t.special(t.string)], color: "#5eead4" },
  // Numbers / booleans / null: amber (not red — red reads as an error).
  { tag: [t.number, t.bool, t.null], color: "#fbbf24" },
  { tag: t.comment, color: "#64748b", fontStyle: "italic" },
  {
    tag: [t.operator, t.punctuation, t.separator, t.bracket, t.derefOperator],
    color: "#94a3b8",
  },
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
      theme="none"
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
