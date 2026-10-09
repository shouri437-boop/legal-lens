// ABOUTME: Theme toggle component for switching between light and dark modes
// ABOUTME: Uses next-themes for theme management with smooth transitions

"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

// Detect client-side mount without useEffect+setState cascade.
// useSyncExternalStore returns false on the server and true on the client,
// avoiding hydration mismatch with next-themes' deferred theme resolution.
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!mounted) {
    return <div className="w-9 h-9 rounded-lg bg-muted/50 animate-pulse" />;
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
      style={{
        background: "var(--muted)",
        color: "var(--foreground)",
      }}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 transition-transform duration-200" />
      ) : (
        <Moon className="w-4 h-4 transition-transform duration-200" />
      )}
    </button>
  );
}
