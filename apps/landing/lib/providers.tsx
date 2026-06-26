"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Web3AuthProvider } from "./web3Auth";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:            10_000,
            retry:                2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Web3AuthProvider>{children}</Web3AuthProvider>
    </QueryClientProvider>
  );
}
