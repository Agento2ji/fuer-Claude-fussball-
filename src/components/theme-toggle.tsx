"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/** Script für <head>: setzt das Theme vor dem ersten Rendern (kein Flackern). */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

export function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      aria-label={dark ? "Hellen Modus einschalten" : "Dunklen Modus einschalten"}
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}
