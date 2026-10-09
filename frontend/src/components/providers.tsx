// ABOUTME: Root providers wrapper for client-side context providers
// ABOUTME: Wraps next-themes ThemeProvider with production-grade configuration

"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { DetailSidebarProvider } from "@/contexts/detail-sidebar-context";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes
            refetchOnWindowFocus: false,
            retry: 3,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
        storageKey="legal-lens-theme"
      >
        <DetailSidebarProvider>{children}</DetailSidebarProvider>
      </NextThemesProvider>
    </QueryClientProvider>
  );
}
