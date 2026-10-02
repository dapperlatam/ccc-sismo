"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Axis, CCCRecord } from "@/lib/types";
import Combobox from "./Combobox";
import { exportToExcel } from "@/lib/exportExcel";

const AXES: Axis[] = [
  "Financiamiento y liquidez",
  "Operación o ventas",
  "Conexiones",
];
const PAGE_SIZE = 20;
const STORAGE_KEY = "ccc-sismo:revisadas";
const SISMO_DATE = "2026-08-10";

function norm(s: string | null | undefined) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toISO(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Formato fijo de fecha y hora (igual en servidor y navegador)
function formatBogota(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}, ${get("hour")}:${get("minute")}`;
}

// Atajos de fecha
function weekRange(): [string, string] {
  const now = new Date();
  const offset = (now.getDay() + 6) % 7; // lunes = 0
  const mon = new Date(now);
  mon.setDate(now.getDate() - offset);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return [toISO(mon), toISO(sun)];
}
function monthRange(): [string, string] {
  const now = new Date();
  return [
    toISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  ];
}
function sismoRange(): [string, string] {
  return [SISMO_DATE, ""];
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none";
const labelCls =
  "text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-faint)]";

export default function Explorer({
  records,
  generatedAt,
}: {
  records: CCCRecord[];
  generatedAt: string;
}) {
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState(""); // record_type
  const [sismo, setSismo] = useState(""); // earthquake_related
  const [axes, setAxes] = useState<Axis[]>([]); // axes
  const [entity, setEntity] = useState(""); // entity
  const [ambito, setAmbito] = useState(""); // entity_ambito
  const [desde, setDesde] = useState(""); // publication_date (desde)
  const [hasta, setHasta] = useState(""); // publication_date (hasta)
  const [soloVigentes, setSoloVigentes] = useState(false); // is_active
  const [soloNuevos, setSoloNuevos] = useState(false); // first_seen_at
  const [soloVerificar, setSoloVerificar] = useState(false); // needs_review
  const [revision, setRevision] = useState(""); // revisión del equipo
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // REVISIÓN DEL EQUIPO: id del registro -> fecha en que se marcó
  const [reviewed, setReviewed] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setReviewed(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reviewed));
    } catch {}
  }, [reviewed, loaded]);

  function toggleReviewed(id: string) {
    setReviewed((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = new Date().toISOString();
      return next;
    });
  }

  const entities = useMemo(
    () => Array.from(new Set(records.map((r) => r.entity))).sort((a, b) => a.localeCompare(b, "es")),
    [records]
  );
  const ambitos = useMemo(
    () => Array.from(new Set(records.map((r) => r.entity_ambito))).sort(),
    [records]
  );

  // ESTADÍSTICAS (sobre todo el dataset, sin filtros)
  const stats = useMemo(() => {
    const now = Date.now();
    return [
      { label: "Total de registros", value: records.length },
      { label: "Entidades con registros", value: entities.length },
      {
        label: "Ayudas / Regulaciones",
        value: `${records.filter((r) => r.record_type === "ayuda").length} / ${
          records.filter((r) => r.record_type === "regulacion").length
        }`,
      },
      {
        label: "Relacionados con el sismo",
        value: records.filter((r) => r.earthquake_related).length,
      },
      {
        label: "Nuevos en 24 h",
        value: records.filter((r) => now - Date.parse(r.first_seen_at) <= 86_400_000).length,
      },
    ];
  }, [records, entities]);

  const reviewedCount = useMemo(
    () => records.filter((r) => reviewed[r.id]).length,
    [records, reviewed]
  );

  const filtered = useMemo(() => {
    const nq = norm(q);
    const now = Date.now();
    return records.filter((r) => {
      if (tipo && r.record_type !== tipo) return false;
      if (sismo && String(r.earthquake_related) !== sismo) return false;
      if (axes.length && !axes.some((a) => r.axes.includes(a))) return false;
      if (entity && r.entity !== entity) return false;
      if (ambito && r.entity_ambito !== ambito) return false;
      if (soloVigentes && !r.is_active) return false;
      if (soloVerificar && !r.needs_review) return false;
      if (revision === "pendientes" && reviewed[r.id]) return false;
      if (revision === "revisadas" && !reviewed[r.id]) return false;
      if (soloNuevos && now - Date.parse(r.first_seen_at) > 86_400_000) return false;
      // rango de fechas sobre publication_date (formato YYYY-MM-DD)
      if (desde && (!r.publication_date || r.publication_date < desde)) return false;
      if (hasta && (!r.publication_date || r.publication_date > hasta)) return false;
      if (nq) {
        // búsqueda de texto: title, description, epigraph
        const texto = norm(`${r.title} ${r.description} ${r.epigraph}`);
        if (!texto.includes(nq)) return false;
      }
      return true;
    });
  }, [
    records, q, tipo, sismo, axes, entity, ambito, desde, hasta,
    soloVigentes, soloNuevos, soloVerificar, revision, reviewed,
  ]);

  // Al cambiar un filtro se vuelve a la página 1
  // (marcar una tarjeta como revisada NO reinicia la página)
  useEffect(() => {
    setPage(1);
  }, [q, tipo, sismo, axes, entity, ambito, desde, hasta, soloVigentes, soloNuevos, soloVerificar, revision]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function goTo(p: number) {
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleAxis(a: Axis) {
    setAxes((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  function applyRange([d, h]: [string, string]) {
    setDesde(d);
    setHasta(h);
  }

  function isActiveRange([d, h]: [string, string]) {
    return desde === d && hasta === h;
  }

  function reset() {
    setQ(""); setTipo(""); setSismo(""); setAxes([]); setEntity("");
    setAmbito(""); setDesde(""); setHasta(""); setRevision("");
    setSoloVigentes(false); setSoloNuevos(false); setSoloVerificar(false);
  }

  async function onExport() {
    setExporting(true);
    try {
      await exportToExcel(filtered, reviewed);
    } finally {
      setExporting(false);
    }
  }

  const pct = records.length ? (reviewedCount / records.length) * 100 : 0;
  const chips: { label: string; range: [string, string] }[] = [
    { label: "Esta semana", range: weekRange() },
    { label: "Este mes", range: monthRange() },
    { label: "Desde el sismo", range: sismoRange() },
  ];

  return (
    <div>
      {/* ESTADÍSTICAS */}
      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <div className={`${labelCls} mb-2.5`}>{s.label}</div>
            <div className="text-[30px] font-bold tracking-[-0.01em] text-[var(--accent-dark)]">
              {s.value}
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 items-start gap-7 md:grid-cols-[280px_minmax(0,1fr)]">
        {/* PANEL DE FILTROS: fijo al hacer scroll y con scroll propio si no cabe */}
        <aside className="flex flex-col gap-[22px] rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] p-[22px] md:sticky md:top-6 md:max-h-[calc(100vh-3rem)] md:overflow-y-auto">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={labelCls}>Avance de revisión</span>
              <span className="text-xs font-semibold text-[var(--ink-soft)]">
                {reviewedCount} de {records.length}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-[var(--surface-3)]">
              <div
                className="h-full min-w-[4px] rounded bg-[var(--accent)]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className={labelCls}>Estado de revisión</span>
            <select className={inputCls} value={revision} onChange={(e) => setRevision(e.target.value)}>
              <option value="">Todas</option>
              <option value="revisadas">Revisadas</option>
              <option value="pendientes">Pendientes</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <span className={labelCls}>Buscar</span>
            <input
              className={inputCls}
              placeholder="Título, descripción o epígrafe"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className={labelCls}>Fecha de publicación</span>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <div className="mb-1 text-xs text-[var(--ink-soft)]">Desde</div>
                <input
                  type="date"
                  className={inputCls}
                  value={desde}
                  max={hasta || undefined}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-[var(--ink-soft)]">Hasta</div>
                <input
                  type="date"
                  className={inputCls}
                  value={hasta}
                  min={desde || undefined}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              {chips.map((c) => {
                const on = isActiveRange(c.range);
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => (on ? applyRange(["", ""]) : applyRange(c.range))}
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      on
                        ? "border-[var(--accent)] bg-[var(--accent)] font-semibold text-[var(--surface)]"
                        : "border-[var(--border)] bg-[var(--surface)] font-medium text-[var(--ink-soft)]"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            {(desde || hasta) && (
              <p className="text-xs text-[var(--ink-faint)]">
                Los registros sin fecha de publicación completa no aparecen
                cuando se filtra por fechas.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className={labelCls}>Tipo</span>
            <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              <option value="ayuda">Ayuda</option>
              <option value="regulacion">Regulación</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <span className={labelCls}>Relacionado con el sismo</span>
            <select className={inputCls} value={sismo} onChange={(e) => setSismo(e.target.value)}>
              <option value="">Todos</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <span className={labelCls}>Eje</span>
            <div className="space-y-1.5">
              {AXES.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                  <input
                    type="checkbox"
                    className="accent-[var(--accent)]"
                    checked={axes.includes(a)}
                    onChange={() => toggleAxis(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className={labelCls}>Entidad</span>
            <Combobox options={entities} value={entity} onChange={setEntity} />
          </div>

          <div className="flex flex-col gap-2">
            <span className={labelCls}>Ámbito</span>
            <select className={inputCls} value={ambito} onChange={(e) => setAmbito(e.target.value)}>
              <option value="">Todos</option>
              {ambitos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 text-sm text-[var(--ink-soft)]">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-[var(--accent)]" checked={soloVigentes} onChange={(e) => setSoloVigentes(e.target.checked)} />
              Solo vigentes
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-[var(--accent)]" checked={soloNuevos} onChange={(e) => setSoloNuevos(e.target.checked)} />
              Nuevos en las últimas 24 h
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-[var(--accent)]" checked={soloVerificar} onChange={(e) => setSoloVerificar(e.target.checked)} />
              Solo con datos por verificar
            </label>
          </div>

          <button
            type="button"
            onClick={reset}
            className="self-start text-[13px] font-semibold text-[var(--accent-dark)] underline underline-offset-[3px]"
          >
            Limpiar filtros
          </button>
        </aside>

        {/* RESULTADOS */}
        <section className="flex min-w-0 flex-col gap-4">
          <div ref={topRef} className="mb-1 flex scroll-mt-6 items-center justify-between gap-4">
            <div className="text-[13px] text-[var(--ink-faint)]">
              {filtered.length} de {records.length} registros · Datos generados el{" "}
              {formatBogota(generatedAt)}
            </div>
            <button
              type="button"
              onClick={onExport}
              disabled={exporting || filtered.length === 0}
              title="Se exporta lo que esté actualmente seleccionado en los filtros"
              className="shrink-0 cursor-pointer rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2 text-[13px] font-semibold text-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? "Exportando..." : "Exportar a Excel"}
            </button>
          </div>

          {pageItems.map((r) => (
            <Card
              key={r.id}
              r={r}
              reviewedAt={reviewed[r.id]}
              onToggle={() => toggleReviewed(r.id)}
            />
          ))}

          {filtered.length === 0 && (
            <p className="py-10 text-center text-[var(--ink-faint)]">
              No hay registros con esos filtros.
            </p>
          )}

          {filtered.length > 0 && (
            <div className="mt-3 flex items-center justify-center gap-[18px]">
              <button
                type="button"
                disabled={current === 1}
                onClick={() => goTo(current - 1)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-semibold text-[var(--accent-dark)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--ink-faint)]"
              >
                Anterior
              </button>
              <span className="text-[13px] text-[var(--ink-faint)]">
                Página {current} de {totalPages}
              </span>
              <button
                type="button"
                disabled={current === totalPages}
                onClick={() => goTo(current + 1)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-semibold text-[var(--accent-dark)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--ink-faint)]"
              >
                Siguiente
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

function Line({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="text-sm leading-relaxed text-[var(--ink-soft)]">
      <span className="font-semibold text-[var(--ink)]">{label}: </span>
      {value}
    </div>
  );
}

function Card({
  r,
  reviewedAt,
  onToggle,
}: {
  r: CCCRecord;
  reviewedAt?: string;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const done = Boolean(reviewedAt);
  const isAyuda = r.record_type === "ayuda";
  const linkCls =
    "text-[13px] font-semibold text-[var(--accent-dark)] underline underline-offset-[3px]";

  return (
    <article className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] px-7 py-[26px]">
      {/* SELLO DE REVISADA: única señal visual de que está revisada */}
      {done && (
        <span
          role="img"
          aria-label="Revisada"
          title="Revisada"
          className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--good)] text-[var(--surface)] shadow-md ring-4 ring-[var(--ground)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}

      <div className="mb-3.5 flex flex-wrap gap-2">
        <Pill
          className={
            isAyuda
              ? "bg-[var(--good-soft)] text-[var(--good)]"
              : "bg-[var(--accent-lighter)] text-[var(--accent-dark)]"
          }
        >
          {isAyuda ? "Ayuda" : "Regulación"}
        </Pill>
        {r.earthquake_related && (
          <Pill className="bg-[var(--brass-soft)] text-[var(--brass-dark)]">Sismo</Pill>
        )}
        {r.axes.map((a) => (
          <Pill key={a} className="bg-[var(--surface-3)] text-[var(--ink-soft)]">{a}</Pill>
        ))}
        {r.needs_review && (
          <span
            title={`Revisión automática: ${r.needs_review_reason ?? "datos incompletos"}`}
            className="rounded-full border border-[var(--brass)] px-2.5 py-[3px] text-[11px] font-semibold text-[var(--brass-dark)]"
          >
            Datos por verificar
          </span>
        )}
        {!r.is_active && (
          <Pill className="bg-[var(--surface-3)] text-[var(--ink-faint)]">Vencida</Pill>
        )}
      </div>

      <h3 className="mb-1.5 text-[19px] font-semibold leading-snug text-[var(--ink)]">
        {r.title}
      </h3>
      <div className="mb-3 text-[13px] text-[var(--ink-faint)]">
        {r.entity} · {r.entity_ambito}
        {r.publication_date ? ` · ${r.publication_date}` : ""}
      </div>
      {r.description && (
        <p className="mb-1 text-[14.5px] leading-[1.6] text-[var(--ink-soft)]">
          {r.description}
        </p>
      )}

      {expanded && (
        <>
          <div className="mt-3.5 flex flex-col gap-1">
            <Line label="Beneficio" value={r.amount_or_benefit} />
            <Line label="Vigencia" value={r.end_date_text} />
            <Line label="Epígrafe" value={r.epigraph} />
            <Line label="Requisitos" value={r.eligibility} />
            <Line label="Necesidad que atiende" value={r.specific_need} />
            <Line label="Tipo de apoyo" value={r.support_type} />
            <Line label="Segmento" value={r.segment} />
            <Line label="Sector" value={r.sector_focus} />
            <Line label="Cobertura" value={r.territorial_coverage} />
            <Line label="Entidad emisora" value={r.issuing_entity} />
            <Line label="Contacto" value={r.contact} />
            <Line label="Teléfono" value={r.contact_phone} />
            <Line label="Evidencia del sismo" value={r.earthquake_evidence} />
            <Line label="Motivo de verificación" value={r.needs_review_reason} />
            {r.key_points.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-sm leading-relaxed text-[var(--ink-soft)]">
                {r.key_points.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-3.5 flex flex-wrap gap-5">
            {r.application_url && (
              <a className={linkCls} href={r.application_url} target="_blank" rel="noreferrer">Aplicar</a>
            )}
            {r.document_url && (
              <a className={linkCls} href={r.document_url} target="_blank" rel="noreferrer">Documento</a>
            )}
            <a className={linkCls} href={r.source_url} target="_blank" rel="noreferrer">Fuente original</a>
            {r.source_archive_url && (
              <a className={linkCls} href={r.source_archive_url} target="_blank" rel="noreferrer">Copia archivada</a>
            )}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex cursor-pointer items-center gap-1.5 bg-transparent pt-3.5 text-[13px] font-semibold text-[var(--accent-dark)]"
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: `rotate(${expanded ? 90 : 0}deg)`, transition: "transform .15s ease" }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {expanded ? "Ocultar detalle" : "Ver detalle"}
      </button>

      <div className="mt-[18px] flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
        {done ? (
          <span className="text-[13px] font-semibold text-[var(--good)]">
            Revisada el {new Date(reviewedAt!).toLocaleDateString("es-CO")}
          </span>
        ) : (
          <span className="text-[13px] font-medium text-[var(--ink-faint)]">
            Pendiente de revisión
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          className={`cursor-pointer rounded-lg border px-3.5 py-[7px] text-[12.5px] font-semibold ${
            done
              ? "border-transparent bg-[var(--good-soft)] text-[var(--good)]"
              : "border-[var(--border)] bg-transparent text-[var(--accent-dark)]"
          }`}
        >
          {done ? "Revisada (deshacer)" : "Marcar revisada"}
        </button>
      </div>
    </article>
  );
}