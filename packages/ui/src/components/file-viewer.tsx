'use client';

import { Editor, type BeforeMount } from '@monaco-editor/react';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';

import type { WorkspaceFile } from '@comparator/contracts';

/**
 * The editor's look is the one agent messages already give their snippets, so a snippet in the chat and a file read
 * as one product: the page's background, GitHub's default light and dark colours for the code, the same type size.
 */
const THEMES = {
  light: {
    base: 'vs',
    background: '#ffffff',
    foreground: '1f2328',
    lineNumber: '#63636380',
    comment: '6e7781',
    keyword: 'cf222e',
    string: '0a3069',
    number: '0550ae',
    type: '953800',
    tag: '116329',
  },
  dark: {
    base: 'vs-dark',
    background: '#0a0a0a',
    foreground: 'e6edf3',
    lineNumber: '#a1a1a180',
    comment: '8b949e',
    keyword: 'ff7b72',
    string: 'a5d6ff',
    number: '79c0ff',
    type: 'ffa657',
    tag: '7ee787',
  },
} as const;

const defineThemes: BeforeMount = (monaco) => {
  for (const [name, theme] of Object.entries(THEMES)) {
    monaco.editor.defineTheme(`comparator-${name}`, {
      base: theme.base,
      // Only the colours below: the base theme's own would bring a second palette.
      inherit: false,
      rules: [
        { token: '', foreground: theme.foreground },
        { token: 'comment', foreground: theme.comment },
        { token: 'keyword', foreground: theme.keyword },
        { token: 'string', foreground: theme.string },
        { token: 'number', foreground: theme.number },
        { token: 'type', foreground: theme.type },
        { token: 'tag', foreground: theme.tag },
        { token: 'attribute.name', foreground: theme.number },
        { token: 'attribute.value', foreground: theme.string },
        { token: 'string.key.json', foreground: theme.tag },
      ],
      colors: {
        'editor.background': theme.background,
        'editor.foreground': `#${theme.foreground}`,
        'editorLineNumber.foreground': theme.lineNumber,
        'editorLineNumber.activeForeground': theme.lineNumber,
        // Brackets in the colour of the text, not one colour per pair.
        ...Object.fromEntries(
          [1, 2, 3, 4, 5, 6].map((level) => [
            `editorBracketHighlight.foreground${level}`,
            `#${theme.foreground}`,
          ]),
        ),
      },
    });
  }
};

/** The theme switches on the `dark` class of the page. */
function watchTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
const isDark = () => document.documentElement.classList.contains('dark');

const NOTE = 'flex h-full items-center justify-center p-4 text-sm text-muted-foreground';
const LOADING = <p className={NOTE}>Loading the editor…</p>;

/** The editor's own code, loaded once from the app's bundle, when the first file is opened. */
let editorCode: Promise<unknown> | undefined;
function useEditorCode(): boolean {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let current = true;
    editorCode ??= import('../editor/setup.ts');
    void editorCode.then(() => current && setLoaded(true));
    return () => {
      current = false;
    };
  }, []);
  return loaded;
}

/**
 * One file, read-only, in a code editor that fills the space it is given. The editor's code is part of the app,
 * and is loaded when the first file is opened, not with the page.
 */
export function FileViewer({ file }: { file: WorkspaceFile }) {
  const dark = useSyncExternalStore(watchTheme, isDark, () => false);
  // Editors keep their text by path: this viewer's own prefix keeps two agents' `index.js` apart.
  const id = useId().replaceAll(':', '');
  const editorLoaded = useEditorCode();

  if (file.state === 'binary')
    return <p className={NOTE}>This is a binary file: its content is not shown.</p>;
  if (!editorLoaded) return LOADING;
  return (
    <Editor
      beforeMount={defineThemes}
      loading={LOADING}
      options={{
        readOnly: true,
        domReadOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: 'none',
        // The snippet's type: the same family, size and line height.
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 14,
        lineHeight: 20,
        padding: { top: 16, bottom: 16 },
        // And none of an editor's extras: indent guides, the ruler beside the scrollbar.
        guides: { indentation: false },
        overviewRulerLanes: 0,
        overviewRulerBorder: false,
        // The snippet's gutter: line numbers and a gap, with no folding arrows or margin for markers.
        lineNumbersMinChars: 4,
        lineDecorationsWidth: 16,
        folding: false,
        glyphMargin: false,
      }}
      path={`${id}/${file.path}`}
      theme={dark ? 'comparator-dark' : 'comparator-light'}
      value={file.content}
    />
  );
}
