import type { ReactNode } from "react";

export const metadata = {
  title: "Stream Sync Friends",
  description: "Backend API for the Stream Sync Friends Chrome extension"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
