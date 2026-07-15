import { type BeforeMount } from "@monaco-editor/react";

/** A dark Monaco theme whose background matches the zinc-900 IDE chrome. Pass as the
 * editor's `beforeMount` and set `theme="interview-dark"`. Shared by the candidate runner
 * and the authoring project editor. */
export const defineInterviewDarkTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("interview-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#18181b",
      "editorGutter.background": "#18181b",
      "editor.lineHighlightBackground": "#27272a",
      "editorLineNumber.foreground": "#52525b",
      "editorLineNumber.activeForeground": "#a1a1aa",
    },
  });
};
