import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import ChatSidebarPanel from "@/components/Chat/ChatSidebarPanel";
import GlobalSocketProvider from "@/components/Collab/GlobalSocketProvider";

export const metadata: Metadata = {
  title: "GrowLouder — Content Production Platform",
  description: "A Notion-like task management and content production platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <GlobalSocketProvider>
            {children}
            <ChatSidebarPanel />
          </GlobalSocketProvider>
        </Providers>
      </body>
    </html>
  );
}
