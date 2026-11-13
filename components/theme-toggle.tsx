"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const subscribeToHydration = () => () => {};

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  const dark = mounted && resolvedTheme === "dark";
  const label = dark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      className={"theme-toggle" + (compact ? " is-compact" : "")}
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </span>
      {!compact && <span className="theme-toggle-text">{dark ? "Light" : "Dark"}</span>}
    </button>
  );
}
