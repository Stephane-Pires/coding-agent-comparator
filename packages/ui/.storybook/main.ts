// Storybook for the design system: every component in isolation, with its states.
import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) => ({ ...viteConfig, plugins: [...(viteConfig.plugins ?? []), tailwindcss()] }),
};

export default config;
