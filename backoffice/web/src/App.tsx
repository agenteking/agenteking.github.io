import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  PARTNERS,
  STATUSES,
  STATUS_LABEL,
  WEBSITE_KINDS,
  WEBSITE_KIND_LABEL,
  type LeadRow,
  type Partner,
} from "../../server/src/domain";
import { api, Unauthorized } from "./api";
import { LeadDrawer } from "./components/LeadDrawer";
import { LeadCards, LeadTable } from "./components/LeadList";
import { Close, LogoMark, Logout, Refresh, Search, Users, Wallet } from "./components/Icons";
import { digits, fold, rubroLabel } from "./format";

// ---------------------------------------------------------------- filtros (en la URL)

const FILTER_KEYS = ["q", "status", "contact", "rubro", "barrio", "web", "sort", "lead"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
type Filters = Record<FilterKey, string>;

function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  return Object.fromEntries(FILTER_KEYS.map((k) => [k, p.get(k) ?? ""])) as Filters;
}

function writeFilters(f: Filters, push: boolean) {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) if (f[k]) p.set(k, f[k]);
  const qs = p.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (push) window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

const isPending = (l: LeadRow) => l.status === "nuevo" && !l.last_contacted_at && !l.do_not_contact;
const isContacted = (l: LeadRow) => Boolean(l.last_contacted_at);

function useIsMobile() {
  const q = "(max-width: 899px)";
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(q);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(q).matches,
  );
}

function loadMe(): Partner {
  try {
    const v = localStorage.getItem("bo_by");
    if (v && (PARTNERS as readonly string[]).includes(v)) return v as Partner;
  } catch {
    /* sin storage */
  }
  return "Kanel";
}

// ---------------------------------------------------------------- app

export function App() {
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(readFilters);
  const [me, setMe] = useState<Partner>(loadMe);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const mobile = useIsMobile();

  const load = useCallback(() => {
    api
      .leads()
      .then((l) => {
        setLeads(l);
        setError(null);
      })
      .catch((e: Error) => {
        if (!(e instanceof Unauthorized)) setError(e.message);
      });
  }, []);

  useEffect(load, [load]);
  useEffect(() => {
    const onPop = () => setFilters(readFilters());
    window.addEventListener("popstate", onPop);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  const set = (patch: Partial<Filters>, push = false) => {
    setFilters((f) => {
      const next = { ...f, ...patch };
      writeFilters(next, push);
      return next;
    });
  };

  const chooseMe = (p: Partner) => {
    setMe(p);
    try {
      localStorage.setItem("bo_by", p);
    } catch {
      /* sin storage */
    }
  };

  const all = useMemo(() => leads ?? [], [leads]);
  const options = useMemo(() => {
    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => Boolean(x)))];
    return {
      rubros: uniq(all.map((l) => l.rubro)).sort((a, b) => rubroLabel(a).localeCompare(rubroLabel(b), "es")),
      barrios: uniq(all.map((l) => l.barrio)).sort((a, b) => a.localeCompare(b, "es")),
      webs: WEBSITE_KINDS.filter((k) => all.some((l) => l.website_kind === k)),
    };
  }, [all]);

  const counts = useMemo(
    () => ({
      total: all.length,
      pendientes: all.filter(isPending).length,
      contactados: all.filter(isContacted).length,
      interesados: all.filter((l) => l.status === "interesado").length,
      clientes: all.filter((l) => l.status === "cliente").length,
    }),
    [all],
  );

  const visible = useMemo(() => {
    const q = fold(filters.q.trim());
    const qd = digits(filters.q);
    const out = all.filter((l) => {
      if (filters.status && l.status !== filters.status) return false;
      if (filters.contact === "pendientes" && !isPending(l)) return false;
      if (filters.contact === "contactados" && !isContacted(l)) return false;
      if (filters.rubro && l.rubro !== filters.rubro) return false;
      if (filters.barrio && l.barrio !== filters.barrio) return false;
      if (filters.web && l.website_kind !== filters.web) return false;
      if (q) {
        const inName = fold(`${l.name} ${l.category ?? ""} ${l.address ?? ""}`).includes(q);
        const inPhone =
          qd.length >= 3 && [l.phone, l.phone_norm, l.whatsapp].some((p) => p && digits(p).includes(qd));
        if (!inName && !inPhone) return false;
      }
      return true;
    });
    if (filters.sort === "resenas") out.sort((a, b) => (b.reviews ?? -1) - (a.reviews ?? -1));
    else if (filters.sort === "contacto")
      out.sort((a, b) => (b.last_contacted_at ?? "").localeCompare(a.last_contacted_at ?? ""));
    else if (filters.sort === "nombre") out.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return out;
  }, [all, filters]);

  const activeFilters = (["q", "status", "contact", "rubro", "barrio", "web"] as const).filter((k) => filters[k]).length;
  const clear = () => set({ q: "", status: "", contact: "", rubro: "", barrio: "", web: "" });

  const onChanged = useCallback(
    (msg: string) => {
      setToast({ msg, kind: "ok" });
      load();
    },
    [load],
  );
  const onError = useCallback((msg: string) => setToast({ msg, kind: "err" }), []);
  const openLead = (id: number) => set({ lead: String(id) }, true);
  const closeLead = () => set({ lead: "" });

  const counter = (
    key: string,
    label: string,
    n: number,
    patch: Partial<Filters>,
    active: boolean,
    tone?: string,
  ) => (
    <button
      type="button"
      className={`stat${active ? " is-on" : ""}${tone ? ` stat--${tone}` : ""}`}
      onClick={() => set({ status: "", contact: "", ...patch })}
      data-stat={key}
    >
      <span className="stat__n">{leads ? n : "–"}</span>
      <span className="stat__label">{label}</span>
    </button>
  );

  return (
    <>
      <header className="top">
        <div className="top__inner">
          <a className="logo" href="/" aria-label="Aparece back office">
            <LogoMark />
            <span>
              Aparece <em className="logo__tag">back office</em>
            </span>
          </a>
          <nav className="tabs" aria-label="Secciones">
            <a className="tab is-on" href="/" aria-current="page">
              <Users width={16} height={16} />
              <span>Clientes potenciales</span>
            </a>
            {/* Próxima etapa: clientes (deals) y pagos (payments). */}
            <span className="tab is-soon" aria-disabled="true" title="Próximamente">
              <Wallet width={16} height={16} />
              <span>Clientes y pagos</span>
              <small>pronto</small>
            </span>
          </nav>
          <div className="top__right">
            <div className="me" role="radiogroup" aria-label="Quién sos">
              {PARTNERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={me === p}
                  className={me === p ? "is-on" : undefined}
                  onClick={() => chooseMe(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <form method="post" action="/logout">
              <button className="icon-btn" type="submit" aria-label="Salir" title="Salir">
                <Logout />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="page">
        <div className="page__head">
          <div>
            <h1>
              Clientes <span className="accent">potenciales</span>
            </h1>
            <p className="lead">Comercios de barrio para ofrecerles su web. Marcá cada contacto así no le escribimos dos veces.</p>
          </div>
          <button className="btn btn--ghost btn--sm" type="button" onClick={load} title="Actualizar">
            <Refresh width={16} height={16} /> Actualizar
          </button>
        </div>

        <section className="stats" aria-label="Resumen">
          {counter("total", "Total", counts.total, {}, !filters.status && !filters.contact)}
          {counter("pendientes", "Pendientes", counts.pendientes, { contact: "pendientes" }, filters.contact === "pendientes", "pend")}
          {counter(
            "contactados",
            "Contactados",
            counts.contactados,
            { contact: "contactados" },
            filters.contact === "contactados",
            "cont",
          )}
          {counter("interesados", "Interesados", counts.interesados, { status: "interesado" }, filters.status === "interesado", "int")}
          {counter("clientes", "Clientes", counts.clientes, { status: "cliente" }, filters.status === "cliente", "cli")}
        </section>

        <section className="filters" aria-label="Filtros">
          <label className="search">
            <Search />
            <input
              type="search"
              placeholder="Buscar por nombre o teléfono"
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              aria-label="Buscar por nombre o teléfono"
            />
          </label>
          <Select label="Estado" value={filters.status} onChange={(v) => set({ status: v })} name="status">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select label="Contacto" value={filters.contact} onChange={(v) => set({ contact: v })} name="contact">
            <option value="pendientes">No contactados</option>
            <option value="contactados">Contactados</option>
          </Select>
          <Select label="Rubro" value={filters.rubro} onChange={(v) => set({ rubro: v })} name="rubro">
            {options.rubros.map((r) => (
              <option key={r} value={r}>
                {rubroLabel(r)}
              </option>
            ))}
          </Select>
          <Select label="Barrio" value={filters.barrio} onChange={(v) => set({ barrio: v })} name="barrio">
            {options.barrios.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          <Select label="Web" value={filters.web} onChange={(v) => set({ web: v })} name="web">
            {options.webs.map((k) => (
              <option key={k} value={k}>
                {WEBSITE_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
          <label className="select select--sort">
            <span className="sr-only">Ordenar</span>
            <select value={filters.sort} onChange={(e) => set({ sort: e.target.value })} name="sort">
              <option value="">Más recientes</option>
              <option value="resenas">Más reseñas</option>
              <option value="contacto">Último contacto</option>
              <option value="nombre">Nombre A–Z</option>
            </select>
          </label>
        </section>

        <div className="results-bar">
          <span data-testid="result-count">
            {leads ? `${visible.length} de ${all.length} comercios` : "Cargando…"}
          </span>
          {activeFilters ? (
            <button type="button" className="link-btn" onClick={clear}>
              <Close width={14} height={14} /> Limpiar filtros
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="empty">
            <b>No pude cargar los leads</b>
            <p>{error}</p>
            <button className="btn btn--primary btn--sm" type="button" onClick={load}>
              Reintentar
            </button>
          </div>
        ) : !leads ? (
          <div className="skeleton" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <b>No hay comercios con esos filtros</b>
            <p>Probá sacando alguno.</p>
            <button className="btn btn--ghost btn--sm" type="button" onClick={clear}>
              Limpiar filtros
            </button>
          </div>
        ) : mobile ? (
          <LeadCards leads={visible} onOpen={openLead} />
        ) : (
          <LeadTable leads={visible} onOpen={openLead} />
        )}
      </main>

      <LeadDrawer
        id={filters.lead ? Number(filters.lead) : null}
        me={me}
        onClose={closeLead}
        onChanged={onChanged}
        onError={onError}
      />

      {toast ? (
        <div className={`toast toast--${toast.kind}`} role="status">
          {toast.msg}
        </div>
      ) : null}
    </>
  );
}

function Select({
  label,
  value,
  onChange,
  name,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  name: string;
  children: ReactNode;
}) {
  return (
    <label className={`select${value ? " is-set" : ""}`}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} name={name}>
        <option value="">{label}: todos</option>
        {children}
      </select>
    </label>
  );
}
