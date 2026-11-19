'use client';

import { Editor, type BeforeMount } from '@monaco-editor/react';
import { useId, useSyncExternalStore } from 'react';

import type { WorkspaceFile } from '@comparator/contracts';

/**
 * The editor's colours: the app's own background, and for the code the colours agent messages already use for
 * their snippets (GitHub's light and dark themes), so a snippet in the chat and the file read as one product.
 */
const THEMES = {
  light: {
    base: 'vs',
    background: '#ffffff',
    comment: '6a737d',
    keyword: 'd73a49',
    string: '032f62',
    number: '005cc5',
    type: '6f42c1',
  },
  dark: {
    base: 'vs-dark',
    background: '#171717',
    comment: '8b949e',
    keyword: 'f97583',
    string: '9ecbff',
    number: '79b8ff',
    type: 'b392f0',
  },
} as const;

const defineThemes: BeforeMount = (monaco) => {
  for (const [name, theme] of Object.entries(THEMES)) {
    monaco.editor.defineTheme(`comparator-${name}`, {
      base: theme.base,
      inherit: true,
      rules: (['comment', 'keyword', 'string', 'number', 'type'] as const).map((token) => ({
        token,
        foreground: theme[token],
      })),
      colors: { 'editor.background': theme.background },
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

/**
 * One file, read-only, in a code editor that fills the space it is given. The editor itself is fetched when the
 * first file is opened, not with the page.
 */
export function FileViewer({ file }: { file: WorkspaceFile }) {
  const dark = useSyncExternalStore(watchTheme, isDark, () => false);
  // Editors keep their text by path: this viewer's own prefix keeps two agents' `index.js` apart.
  const id = useId().replaceAll(':', '');

  if (file.state === 'binary')
    return <p className={NOTE}>This is a binary file: its content is not shown.</p>;
  return (
    <Editor
      beforeMount={defineThemes}
      loading={<p className={NOTE}>Loading the editor…</p>}
      options={{
        readOnly: true,
        domReadOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        renderLineHighlight: 'none',
        // Keep the width for the code: a narrow gutter, with no folding arrows or margin for markers.
        lineNumbersMinChars: 3,
        folding: false,
        glyphMargin: false,
      }}
      path={`${id}/${file.path}`}
      theme={dark ? 'comparator-dark' : 'comparator-light'}
      value={file.content}
    />
  );
}
