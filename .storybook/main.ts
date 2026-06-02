import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  framework: "@storybook/nextjs",
  staticDirs: ["../public"],
};

export default config;
