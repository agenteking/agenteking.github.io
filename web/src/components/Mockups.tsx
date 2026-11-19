import { useEffect, useState, type ReactNode } from "react";
import { AI_EXAMPLES } from "../content";
import { Pin, Search, Sparkle, Star } from "./Icons";
import { Picture } from "./Picture";

export function BrowserFrame({ url, children, className = "", tag }: { url: string; children: ReactNode; className?: string; tag?: string }) {
  return (
    <div className={`browser ${className}`}>
      <div className="browser__bar" aria-hidden>
        <span className="browser__dots">
          <i />
          <i />
          <i />
        </span>
        <span className="browser__url">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <rect x="5" y="10.5" width="14" height="10" rx="2" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
          </svg>
          {url}
        </span>
        <span className="browser__spacer">{tag ? <span className="browser__tag">{tag}</span> : null}</span>
      </div>
      <div className="browser__view">{children}</div>
    </div>
  );
}

export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`phone ${className}`}>
      <div className="phone__screen">{children}</div>
      <span className="phone__island" aria-hidden />
    </div>
  );
}

/** Hero: la demo de ejemplo en un navegador + el flujo de reserva en un celular. */
export function HeroStage() {
  return (
    <div className="stage" aria-label="Ejemplo de una web con reserva de turnos (concepto)">
      <div className="stage__glow" aria-hidden />
      <BrowserFrame url="tunegocio.com.ar" className="stage__browser" tag="Concepto · no es un cliente">
        <Picture
          name="selkis-desktop"
          widths={[640, 820, 1040, 1440]}
          ratio={1.6}
          sizes="(min-width: 1200px) 1000px, (min-width: 760px) 84vw, 92vw"
          alt="Web de ejemplo de un estudio de uñas: portada con botón para reservar turno online"
          priority
        />
      </BrowserFrame>
      <PhoneFrame className="stage__phone">
        <Picture
          name="selkis-booking"
          widths={[300, 390]}
          ratio={390 / 844}
          sizes="(min-width: 760px) 230px, 34vw"
          alt="Paso de la reserva para elegir día y horario, en el celular"
        />
      </PhoneFrame>
      <div className="stage__toast" aria-hidden>
        <span className="stage__toast-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M5 12.5l4.2 4.2L19 7" />
          </svg>
        </span>
        <span>
          <b>Nuevo turno</b>
          <small>Jueves 19 · 12:30 · reservado a las 23:47</small>
        </span>
      </div>
    </div>
  );
}

/** Mockup de un asistente de IA recomendando un negocio. Rota entre rubros. Todo ilustrativo. */
export function AiChat() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % AI_EXAMPLES.length), 5200);
    return () => window.clearInterval(id);
  }, []);
  const ex = AI_EXAMPLES[i] ?? AI_EXAMPLES[0];
  return (
    <div className="ai" aria-hidden>
      <div className="ai__head">
        <span className="ai__logo">
          <Sparkle width={14} height={14} />
        </span>
        Asistente de IA
        <span className="ai__dots">
          {AI_EXAMPLES.map((e, n) => (
            <i key={e.url} className={n === i ? "on" : ""} />
          ))}
        </span>
      </div>
      <div className="ai__body" key={i}>
        <p className="ai__q">{ex.q}</p>
        <div className="ai__a">
          <p>
            Te recomiendo <b>{ex.name}</b>: {ex.detail}
          </p>
          <span className="ai__src">
            <span className="ai__fav" />
            {ex.url}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Mockup genérico de un resultado local en un buscador (ilustrativo, sin marcas). */
export function SearchMock() {
  return (
    <div className="serp" aria-hidden>
      <div className="serp__bar">
        <Search width={15} height={15} />
        <span>pilates reformer en Palermo</span>
      </div>
      <div className="serp__card serp__card--top">
        <div className="serp__row">
          <span className="serp__name">Tu Estudio</span>
          <span className="serp__badge">Abierto</span>
        </div>
        <div className="serp__meta">
          <span className="serp__stars">
            {[0, 1, 2, 3, 4].map((n) => (
              <Star key={n} width={12} height={12} />
            ))}
          </span>
          4,9 · Estudio de pilates
        </div>
        <div className="serp__meta">
          <Pin width={12} height={12} /> Palermo · cierra 21 h
        </div>
        <div className="serp__actions">
          <span className="serp__btn serp__btn--primary">Reservar turno</span>
          <span className="serp__btn">Sitio web</span>
          <span className="serp__btn">Cómo llegar</span>
        </div>
      </div>
      <div className="serp__card serp__card--ghost">
        <span className="serp__line" style={{ width: "46%" }} />
        <span className="serp__line" style={{ width: "70%" }} />
      </div>
      <div className="serp__card serp__card--ghost">
        <span className="serp__line" style={{ width: "38%" }} />
        <span className="serp__line" style={{ width: "62%" }} />
      </div>
    </div>
  );
}
