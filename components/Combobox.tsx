"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function Combobox({
  options,
  value,
  onChange,
  placeholder = "Todas",
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // "" = quitar el filtro (opción "Todas")
  const items = useMemo(() => {
    const n = norm(query);
    if (!n) return ["", ...options];
    return options.filter((o) => norm(o).includes(n));
  }, [options, query]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open && items[active] !== undefined) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={boxRef}>
      <div className="relative">
        <input
          type="text"
          value={open ? query : value}
          placeholder={open ? "Escribe para buscar..." : placeholder}
          onFocus={() => { setOpen(true); setActive(0); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
          onKeyDown={onKeyDown}
          className="w-full truncate rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-3 pr-8 text-sm text-[var(--ink)] placeholder:text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
        />
        {value && !open ? (
          <button
            type="button"
            aria-label="Quitar filtro de entidad"
            onClick={() => choose("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
          >
            ✕
          </button>
        ) : (
          <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </div>

      {/* La lista va dentro del flujo (no flotante) para que el panel
          de filtros pueda hacer scroll sin recortarla */}
      {open && (
        <ul
          ref={listRef}
          className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 text-sm"
        >
          {items.length === 0 && (
            <li className="px-3 py-2 text-[var(--ink-faint)]">Sin resultados</li>
          )}
          {items.map((o, i) => (
            <li
              key={o || "__todas"}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-1.5 ${
                i === active ? "bg-[var(--surface-3)]" : ""
              } ${o === value ? "font-semibold text-[var(--accent-dark)]" : "text-[var(--ink-soft)]"}`}
            >
              {o || "Todas"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}