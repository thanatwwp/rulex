"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
