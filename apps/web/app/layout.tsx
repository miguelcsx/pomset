/**
 * The document the workbench is mounted into.
 *
 * The client is a single page whose state chooses what is on screen, so the
 * layout carries only the shell the workstation expects: the stylesheets in
 * order, and nothing that would compete with the workbench for the viewport.
 */

import type { Metadata, Viewport } from "next";

// One stylesheet entry: it places the workbench's CSS in the lowest cascade
// layer and adds Tailwind for the site pages. See site.css for why.
import "../src/features/styles/site.css";

export const metadata: Metadata = {
  title: "pomset",
  description:
    "Is this parallel kernel correct, safe and efficient across the inputs and configurations I actually intend to use, and when it is not, why?",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
