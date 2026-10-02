"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "ccc-sismo:tema";

export default function Header() {
  const [dark, setDark] = useState(false);

  // Lee el tema que dejó puesto el script de layout.tsx
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {}
  }

  return (
    <header>
      <div className="mb-7 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-dapper-horizontal.png"
            alt="Dapper"
            className="logo-dapper h-[30px] w-auto"
          />
          <div className="h-8 w-px bg-[var(--border)]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-ccc.jpeg"
            alt="Cámara de Comercio de Cali"
            className="logo-ccc h-10 w-auto"
          />
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2 text-[13px] font-medium text-[var(--ink-soft)]"
        >
          {dark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          <span>{dark ? "Oscuro" : "Claro"}</span>
        </button>
      </div>

      <h1 className="mb-3.5 text-[26px] font-bold leading-tight tracking-[-0.01em] text-[var(--ink)] md:text-[32px]">
        Monitoreo de fuentes oficiales para la Cámara de Comercio de Cali
      </h1>
      <div className="mb-3.5 h-[3px] w-14 rounded-sm bg-[var(--brass)]" />
      <p className="text-base text-[var(--ink-soft)]">
        Ayudas y regulaciones relevantes para empresas tras el sismo del 10 de
        agosto de 2026.
      </p>
    </header>
  );
}