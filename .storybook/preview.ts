import type { Preview } from "@storybook/nextjs";
import { initialize, mswLoader } from "msw-storybook-addon";
import { hcmHandlers } from "../src/mocks/mswHandlers";

initialize({ onUnhandledRequest: "bypass" });

const preview: Preview = {
  loaders: [mswLoader],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    msw: {
      handlers: hcmHandlers,
    },
  },
};

export default preview;
