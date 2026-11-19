import * as Accordion from "@radix-ui/react-accordion";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { formatARS, formatDuration, getServices, type BusinessHour, type PublicData, type Service } from "./api";
import {
  IconArrow,
  IconCalendar,
  IconCap,
  IconClock,
  IconFacebook,
  IconInstagram,
  IconPin,
  IconPlus,
  IconShield,
  IconSparkle,
  IconStar,
  IconWhatsApp,
} from "./components/Icons";
import type { SheetState } from "./components/BookingSheet";
import { Picture } from "./components/Picture";
import { DEMO_BRAND, business, faqs, reviews, waLink, weekdayNames } from "./content";

// Dialog + flujo de reserva: se descargan recién al primer click en "Reservar".
const BookingSheet = lazy(() => import("./components/BookingSheet"));
const prefetchBooking = () => {
  void import("./components/BookingSheet");
  void import("./booking/BookingFlow");
};
const prefetchManage = () => void import("./booking/ManageFlow");

function Wordmark() {
  return (
    <span className="wordmark" aria-label="Selkis Estudio">
      <span className="wordmark-diamond" aria-hidden />
      <span className="wordmark-name">SELKIS</span>
      <span className="wordmark-script">Estudio</span>
    </span>
  );
}

function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <span>
        <strong>Sitio de muestra</strong> · Demo hecha por {DEMO_BRAND}. No es la web oficial de Selkis; precios
        orientativos.
      </span>
    </div>
  );
}

function Header({ onBook }: { onBook: () => void }) {
  return (
    <header className="header">
      <div className="container header-inner">
        <a href="#top" className="header-logo">
          <Wordmark />
        </a>
        <nav className="header-nav" aria-label="Secciones">
          <a href="#servicios">Servicios</a>
          <a href="#estudio">El estudio</a>
          <a href="#resenas">Reseñas</a>
          <a href="#visitanos">Visitanos</a>
          <a href="#mi-turno">Mi turno</a>
        </nav>
        <button type="button" className="btn btn-dark btn-sm" onClick={onBook}>
          Reservar turno
        </button>
      </div>
    </header>
  );
}

function Hero({ onBook }: { onBook: () => void }) {
  return (
    <section className="hero" id="top">
      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="eyebrow reveal">
            <span className="eyebrow-long">Uñas · Cejas & pestañas · Depilación láser</span>
            <span className="eyebrow-short">Uñas · Cejas · Pestañas · Láser</span>
          </p>
          <h1 className="hero-title">
            Uñas que <em>duran</em>.<br />
            Turnos que respetan <br className="br-desk" />
            tu tiempo.
          </h1>
          <p className="hero-lead reveal">
            Kapping, esculpidas y nail art a medida en Parque Chacabuco. Elegí servicio, día y horario y reservá en un
            minuto — sin esperar respuesta por DM.
          </p>
          <div className="hero-ctas reveal">
            <button type="button" className="btn btn-accent btn-lg" onClick={onBook}>
              Reservar turno online <IconArrow size={18} />
            </button>
            <a className="btn btn-ghost btn-lg" href={waLink()} target="_blank" rel="noopener">
              <IconWhatsApp size={18} /> WhatsApp
            </a>
          </div>
          <p className="manage-hint reveal">
            ¿Ya tenés turno? <a href="#mi-turno">Cambialo o cancelalo acá</a>
          </p>
          <a className="rating-chip reveal" href={business.maps} target="_blank" rel="noopener">
            <span className="stars" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => (
                <IconStar key={i} size={14} />
              ))}
            </span>
            <span>
              <strong>{business.rating}</strong> en Google · {business.reviewsCount} reseñas
            </span>
          </a>
        </div>
        <div className="hero-media">
          <div className="hero-diamond" aria-hidden />
          <div className="hero-frame">
            <Picture
              name="hero"
              widths={[480, 800, 1200]}
              ratio={4 / 5}
              sizes="(min-width: 960px) 40vw, 88vw"
              alt="Manos con esmaltado nude sobre una manta suave"
              priority
            />
            <span className="photo-note">Foto ilustrativa</span>
          </div>
          <div className="hero-card">
            <span className="hero-card-k">hasta 20 días</span>
            <span className="hero-card-v">impecable, según nuestras clientas</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const items = ["Kapping gel", "Semipermanente", "Esculpidas", "Nail art", "Pedicuría", "Lifting", "Cejas", "Láser"];
  const row = [...items, ...items];
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee-track">
        {row.map((t, i) => (
          <span key={i}>
            {t}
            <i>◆</i>
          </span>
        ))}
      </div>
    </div>
  );
}

function Services({ services, onBook }: { services: Service[] | null; onBook: (id?: string) => void }) {
  const categories = useMemo(() => [...new Set((services ?? []).map((s) => s.category))], [services]);
  const [chosen, setCat] = useState<string>("Todos");
  const cat = categories.includes(chosen) ? chosen : "Todos";
  const shown = (services ?? []).filter((s) => cat === "Todos" || s.category === cat);
  return (
    <section className="section" id="servicios">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">Servicios</p>
          <h2 className="section-title">
            Todo para tus manos, tus pies <em>y tu mirada</em>
          </h2>
          <p className="section-lead">
            Precios “desde”, <strong>orientativos de muestra</strong>: el valor final se confirma en el estudio según
            largo, diseño y zona.
          </p>
        </div>
        <div className="chips" role="tablist" aria-label="Filtrar por categoría">
          {["Todos", ...categories].map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cat === c}
              className={`chip ${cat === c ? "is-active" : ""}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="service-grid">
          {services === null
            ? Array.from({ length: 6 }, (_, i) => <div key={i} className="service-card is-skeleton" />)
            : shown.map((s) => (
                <article key={s.id} className="service-card">
                  <div className="service-top">
                    <span className="service-cat">{s.category}</span>
                    <span className="service-dur">
                      <IconClock size={14} /> {formatDuration(s.durationMin)}
                    </span>
                  </div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <div className="service-bottom">
                    <span className="price">
                      <small>desde</small> {formatARS(s.priceFrom)}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onBook(s.id)}
                      aria-label={`Reservar ${s.name}`}
                    >
                      <IconPlus size={18} />
                    </button>
                  </div>
                </article>
              ))}
        </div>
      </div>
    </section>
  );
}

function Studio() {
  const points = [
    {
      icon: <IconCap size={22} />,
      t: "Salón & academia",
      d: "Quienes forman a nuevas manicuras son las mismas que te atienden. Técnica al día, siempre.",
    },
    {
      icon: <IconSparkle size={22} />,
      t: "Diseño a tu medida",
      d: "Traé tu idea: nail art, colores y formas hechos con paciencia y detalle.",
    },
    {
      icon: <IconShield size={22} />,
      t: "Productos de calidad",
      d: "Varias capas, buenos productos y un espacio higiénico para que el resultado dure.",
    },
  ];
  return (
    <section className="section section-tint" id="estudio">
      <div className="container studio-grid">
        <div className="studio-media">
          <Picture
            name="studio"
            widths={[480, 800]}
            ratio={4 / 5}
            sizes="(min-width: 960px) 38vw, 92vw"
            alt="Manicura trabajando con lámpara de secado"
          />
          <span className="photo-note">Foto ilustrativa</span>
        </div>
        <div>
          <p className="eyebrow">El estudio</p>
          <h2 className="section-title">
            Un rato para vos, <em>en el barrio</em>
          </h2>
          <p className="section-lead">
            En Av. Directorio 100, a pasos de Parque Chacabuco. Un lugar pensado para que te relajes mientras te
            dejamos las manos como te las imaginaste.
          </p>
          <ul className="points">
            {points.map((p) => (
              <li key={p.t}>
                <span className="point-icon">{p.icon}</span>
                <div>
                  <h3>{p.t}</h3>
                  <p>{p.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Team({ data, onBook }: { data: PublicData | null; onBook: () => void }) {
  const team = data?.professionals ?? null;
  return (
    <section className="section" id="equipo" aria-labelledby="equipo-t">
      <div className="container">
        <div className="section-head section-head-row">
          <div>
            <p className="eyebrow">El equipo</p>
            <h2 className="section-title" id="equipo-t">
              Quiénes te <em>atienden</em>
            </h2>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onBook}>
            <IconCalendar size={18} /> Elegí con quién
          </button>
        </div>
        <ul className="team-grid">
          {team === null
            ? Array.from({ length: 3 }, (_, i) => <li key={i} className="team-card is-skeleton" />)
            : team.map((p) => {
                // En el orden del catálogo (el mismo que la lista de servicios).
                const does = (data?.services ?? []).filter((s) => p.serviceIds.includes(s.id)).map((s) => s.name);
                return (
                  <li key={p.id} className="team-card">
                    <span className="team-avatar" aria-hidden>
                      {p.name.trim().slice(-1).toUpperCase()}
                    </span>
                    <div>
                      <h3>{p.name}</h3>
                      {p.specialty && <p className="team-spec">{p.specialty}</p>}
                      {does.length > 0 && <p className="team-does">{does.join(" · ")}</p>}
                    </div>
                  </li>
                );
              })}
        </ul>
        <p className="fineprint">Nombres de muestra: el estudio carga su equipo real desde el panel.</p>
      </div>
    </section>
  );
}

function Gallery() {
  const items = [
    { name: "art", alt: "Nail art rojo con letras" },
    { name: "pastel", alt: "Uñas en tonos pastel y glitter" },
    { name: "dark", alt: "Uñas oscuras con detalles dorados" },
    { name: "cozy", alt: "Uñas nude con diseño minimalista" },
  ];
  return (
    <section className="section" aria-labelledby="galeria-t">
      <div className="container">
        <div className="section-head section-head-row">
          <div>
            <p className="eyebrow">Inspiración</p>
            <h2 className="section-title" id="galeria-t">
              Ideas para tu <em>próximo turno</em>
            </h2>
          </div>
          <a className="btn btn-ghost" href={business.instagram} target="_blank" rel="noopener">
            <IconInstagram size={18} /> Trabajos reales en {business.instagramHandle}
          </a>
        </div>
        <div className="gallery">
          {items.map((it) => (
            <figure key={it.name} className="gallery-item">
              <Picture
                name={it.name}
                widths={[400, 700]}
                ratio={3 / 4}
                sizes="(min-width: 960px) 23vw, 46vw"
                alt={it.alt}
              />
            </figure>
          ))}
        </div>
        <p className="fineprint">Fotos ilustrativas de stock (Unsplash). Los trabajos del estudio están en su Instagram.</p>
      </div>
    </section>
  );
}

function Reviews() {
  return (
    <section className="section section-dark" id="resenas">
      <div className="container">
        <div className="reviews-head">
          <div>
            <p className="eyebrow eyebrow-light">Reseñas reales de Google</p>
            <h2 className="section-title">
              “Respetan el horario” <em>y se nota</em>
            </h2>
          </div>
          <div className="score">
            <span className="score-n">{business.rating}</span>
            <span className="score-stars" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => (
                <IconStar key={i} size={16} />
              ))}
            </span>
            <span className="score-c">{business.reviewsCount} reseñas en Google Maps</span>
          </div>
        </div>
        <div className="review-grid">
          {reviews.map((r) => (
            <figure key={r.author} className="review">
              <blockquote>{r.text}</blockquote>
              <figcaption>
                <span className="avatar" aria-hidden>
                  {r.author[0]}
                </span>
                {r.author} <span>· Google Maps</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Steps({ onBook }: { onBook: () => void }) {
  const steps = [
    { n: "01", t: "Elegí tu servicio", d: "Con duración y precio de referencia a la vista." },
    { n: "02", t: "Día y horario", d: "Solo ves los horarios libres de verdad, según la agenda del estudio." },
    { n: "03", t: "Listo", d: "Te queda el código de reserva. Sin idas y vueltas por DM." },
  ];
  return (
    <section className="section">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">Turnos online</p>
          <h2 className="section-title">
            Reservá a cualquier hora, <em>en tres pasos</em>
          </h2>
        </div>
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.n}>
              <span className="step-n">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="center">
          <button type="button" className="btn btn-accent btn-lg" onClick={onBook}>
            <IconCalendar size={18} /> Ver horarios disponibles
          </button>
          <p className="manage-hint">
            ¿Necesitás cambiar o cancelar? <a href="#mi-turno">Gestionar mi turno</a>
          </p>
        </div>
      </div>
    </section>
  );
}

function Visit({ hours }: { hours: BusinessHour[] | null }) {
  // Se calcula en el cliente (el HTML viene prerenderizado en el build).
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => setToday(new Date().getDay()), []);
  const byDay = new Map((hours ?? []).map((h) => [h.weekday, h]));
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <section className="section section-tint" id="visitanos">
      <div className="container visit-grid">
        <div>
          <p className="eyebrow">Visitanos</p>
          <h2 className="section-title">
            Av. Directorio 100, <em>Parque Chacabuco</em>
          </h2>
          <p className="section-lead">Atendemos con turno. Si tenés una duda, escribinos y te respondemos.</p>
          <div className="visit-actions">
            <a className="btn btn-dark" href={business.maps} target="_blank" rel="noopener">
              <IconPin size={18} /> Cómo llegar
            </a>
            <a className="btn btn-ghost" href={waLink()} target="_blank" rel="noopener">
              <IconWhatsApp size={18} /> {business.phoneDisplay}
            </a>
          </div>
        </div>
        <div className="hours-card">
          <h3>
            <IconClock size={18} /> Horarios
          </h3>
          <ul>
            {order.map((d) => {
              const h = byDay.get(d);
              return (
                <li key={d} className={d === today ? "is-today" : ""}>
                  <span>
                    {weekdayNames[d]}
                    {d === today && <em>hoy</em>}
                  </span>
                  <span>{hours === null ? "—" : h ? `${h.open} – ${h.close}` : "Cerrado"}</span>
                </li>
              );
            })}
          </ul>
          <p className="fineprint">Según su ficha de Google Maps.</p>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="section" aria-labelledby="faq-t">
      <div className="container faq-grid">
        <div>
          <p className="eyebrow">Preguntas frecuentes</p>
          <h2 className="section-title" id="faq-t">
            Antes de <em>tu turno</em>
          </h2>
        </div>
        <Accordion.Root type="single" collapsible className="faq">
          {faqs.map((f, i) => (
            <Accordion.Item key={f.q} value={`q${i}`} className="faq-item">
              <Accordion.Header asChild>
                <h3>
                  <Accordion.Trigger className="faq-trigger">
                    {f.q}
                    <IconPlus size={18} className="faq-icon" />
                  </Accordion.Trigger>
                </h3>
              </Accordion.Header>
              <Accordion.Content className="faq-content">
                <p>{f.a}</p>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}

function FinalCta({ onBook }: { onBook: () => void }) {
  return (
    <section className="final-cta">
      <div className="container final-inner">
        <h2>
          Tu próximo turno, <em>a un toque</em>.
        </h2>
        <button type="button" className="btn btn-light btn-lg" onClick={onBook}>
          Reservar ahora <IconArrow size={18} />
        </button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <Wordmark />
          <p>
            {business.address}, {business.area}
          </p>
          <p>
            <a href="#mi-turno">Gestionar mi turno</a>
          </p>
        </div>
        <div className="footer-social">
          <a href={business.instagram} target="_blank" rel="noopener" aria-label="Instagram">
            <IconInstagram />
          </a>
          <a href={business.facebook} target="_blank" rel="noopener" aria-label="Facebook">
            <IconFacebook />
          </a>
          <a href={waLink()} target="_blank" rel="noopener" aria-label="WhatsApp">
            <IconWhatsApp />
          </a>
        </div>
      </div>
      <div className="container footer-demo">
        Sitio de muestra hecho por {DEMO_BRAND} para presentarle a Selkis Estudio una web con turnos online. Datos
        públicos de Google Maps e Instagram; fotos ilustrativas de Unsplash; precios orientativos.
      </div>
    </footer>
  );
}

function MobileBar({ onBook }: { onBook: () => void }) {
  return (
    <div className="mobile-bar">
      <a className="btn btn-ghost btn-icon" href={waLink()} target="_blank" rel="noopener" aria-label="WhatsApp">
        <IconWhatsApp size={22} />
      </a>
      <button type="button" className="btn btn-accent grow" onClick={onBook}>
        Reservar turno
      </button>
    </div>
  );
}

const SHEET_HASHES: Record<string, SheetState> = {
  "#reservar": { open: true, mode: "book" },
  "#mi-turno": { open: true, mode: "manage" },
};

/** `initialData`: el catálogo con el que se renderizó el HTML (seed en el build, base viva con Express). */
export function App({ initialData = null }: { initialData?: PublicData | null }) {
  const [data, setData] = useState<PublicData | null>(initialData);
  const [sheet, setSheet] = useState<SheetState>({ open: false, mode: "book" });
  const [sheetLoaded, setSheetLoaded] = useState(false);
  const openSheet = (s: SheetState) => {
    prefetchBooking();
    if (s.mode === "manage") prefetchManage();
    setSheetLoaded(true);
    setSheet(s);
  };
  const open = (serviceId?: string) => openSheet({ open: true, mode: "book", serviceId });
  const changeSheet = (s: SheetState) => {
    setSheet(s);
    // Al cerrar se limpia el #reservar / #mi-turno, así el mismo link vuelve a abrirlo.
    if (!s.open && SHEET_HASHES[window.location.hash]) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };

  useEffect(() => {
    // Links directos: https://…/#reservar y https://…/#mi-turno (también desde links de la página).
    const onHash = () => {
      const s = SHEET_HASHES[window.location.hash];
      if (s) openSheet(s);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Precarga el flujo de reserva cuando el navegador está libre.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2500));
    const t = window.setTimeout(() => idle(prefetchBooking), 3000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    // Datos vivos (precios, servicios y equipo cargados desde el panel).
    getServices()
      .then(setData)
      .catch(() => setData((d) => d ?? { services: [], hours: [], professionals: [] }));
  }, []);

  return (
    <>
      <DemoBanner />
      <Header onBook={() => open()} />
      <main>
        <Hero onBook={() => open()} />
        <Marquee />
        <Services services={data?.services ?? null} onBook={open} />
        <Studio />
        <Team data={data} onBook={() => open()} />
        <Reviews />
        <Gallery />
        <Steps onBook={() => open()} />
        <Visit hours={data?.hours ?? null} />
        <Faq />
        <FinalCta onBook={() => open()} />
      </main>
      <Footer />
      <MobileBar onBook={() => open()} />
      {sheetLoaded && (
        <Suspense fallback={<div className="sheet-overlay" />}>
          <BookingSheet state={sheet} onChange={changeSheet} />
        </Suspense>
      )}
    </>
  );
}
