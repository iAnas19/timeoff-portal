import type { Preview } from "@storybook/nextjs";
import "../src/app/globals.css";

// Stories are prop-driven (every state is passed in via args), so Storybook does
// not need MSW at runtime — MSW powers the Vitest/Playwright layers instead.
// Initializing the MSW service worker here would also break a subpath deploy
// (e.g. GitHub Pages at /<repo>/), where the worker script isn't at the domain root.

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
