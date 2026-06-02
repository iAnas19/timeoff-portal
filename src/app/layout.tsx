import type { Metadata } from "next";
import { AppProviders } from "@/shared/lib/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExampleHR — Time Off",
  description: "Time-off balances and requests with HCM reconciliation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
