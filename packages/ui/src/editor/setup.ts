// The code editor, taken from the app's own bundle. Without this, the React wrapper downloads the editor from a
// public CDN the first time one is shown. Imported on demand (see `file-viewer.tsx`): it is several megabytes, and
// a page with no file open never needs it.
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// The editor does part of its work in background workers, one kind per family of languages. It would load them
// by a URL pattern that not every bundler understands, so they are handed to it here, each from a file of ours.
// Every `new Worker(new URL('./file', import.meta.url))` is written out in full: a bundler only builds a worker
// when it reads exactly that in the code.
self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case 'json':
        return new Worker(new URL('./json.worker.ts', import.meta.url), { type: 'module' });
      case 'css':
      case 'scss':
      case 'less':
        return new Worker(new URL('./css.worker.ts', import.meta.url), { type: 'module' });
      case 'html':
      case 'handlebars':
      case 'razor':
        return new Worker(new URL('./html.worker.ts', import.meta.url), { type: 'module' });
      case 'typescript':
      case 'javascript':
        return new Worker(new URL('./ts.worker.ts', import.meta.url), { type: 'module' });
      default:
        return new Worker(new URL('./editor.worker.ts', import.meta.url), { type: 'module' });
    }
  },
};

loader.config({ monaco });
