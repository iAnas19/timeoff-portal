import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, within } from "storybook/test";
import { Placeholder } from "./Placeholder";

const meta = {
  title: "Shared/Placeholder",
  component: Placeholder,
} satisfies Meta<typeof Placeholder>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "ExampleHR design-system placeholder (Phase 1)",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/ExampleHR design-system placeholder/i),
    ).toBeInTheDocument();
  },
};
