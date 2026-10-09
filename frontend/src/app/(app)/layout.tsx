// ABOUTME: App shell layout. Authentication is disabled, so there is no session check.
// ABOUTME: Renders the sidebar navigation, the main content area and the detail sidebar.

import { Toaster } from "sonner";

import { Sidebar } from "@/components/app/sidebar";
import { DetailSidebar } from "@/components/app/detail-sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="theme-scope flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--background)" }}
    >
      <Sidebar />
      <main
        className="relative flex-1 min-w-0 overflow-y-auto bg-canvas text-foreground"
        style={{
          backgroundColor: "var(--background)",
          color: "var(--foreground)",
        }}
      >
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--card)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            },
          }}
        />
        {children}
      </main>
      <DetailSidebar />
    </div>
  );
}
