import type { Preview } from '@storybook/react-vite';

import '../src/styles.css';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Light or dark theme',
      toolbar: { title: 'Theme', icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light' },
  // The theme switches on the `.dark` class, as in the app.
  decorators: [
    (story, context) => {
      document.documentElement.classList.toggle('dark', context.globals['theme'] === 'dark');
      return story();
    },
  ],
  parameters: {
    layout: 'padded',
    // An accessibility violation fails the story's check, not just a warning in the panel.
    a11y: { test: 'error' },
    backgrounds: { disable: true },
  },
};

export default preview;
