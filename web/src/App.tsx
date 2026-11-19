import * as Accordion from "@radix-ui/react-accordion";
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { BRAND_NAME, CONTACT_EMAIL, DEMO_URL, SHOW_PRICES, WA_DEFAULT_TEXT, WHATSAPP, waLink } from "./config";
import {
  COMPARE,
  FAQ,
  GEO_POINTS,
  NAV,
  PACKAGES,
  PRINCIPLES,
  PROBLEMS,
  QUERIES,
  SMALL_BENEFITS,
  STEPS,
  type Mark,
} from "./content";
import { ContactForm, PICK_PLAN_EVENT } from "./components/ContactForm";
import {
  ArrowRight,
  Bolt,
  Brand,
  Calendar,
  Chat,
  Check,
  Clock,
  Cross,
  Data,
  Grid,
  LogoMark,
  Mail,
  Menu,
  Minus,
  Search,
  Shield,
  Sparkle,
  WhatsApp,
} from "./components/Icons";
import { AiChat, BrowserFrame, HeroStage, PhoneFrame, SearchMock } from "./components/Mockups";
import { Picture } from "./components/Picture";

const MobileMenu = lazy(() => import("./components/MobileMenu"));

const ICONS = { chat: Chat, grid: Grid, search: Search, brand: Brand, data: Data, clock: Clock, bolt: Bolt } as const;

function Logo() {
  return (
    <a href="#top" className="logo" aria-label={`${BRAND_NAME}, ir al inicio`}>
      <LogoMark />
      <span className="logo__name">{BRAND_NAME}</span>
    </a>
  );
}

function SectionHead({ eyebrow, title, lead, center }: { eyebrow: string; title: ReactNode; lead?: ReactNode; center?: boolean }) {
  return (
    <header className={`shead reveal${center ? " shead--center" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {lead ? <p className="lead">{lead}</p> : null}
    </header>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const [menuLoaded, setMenuLoaded] = useState(false);
  return (
    <header className="nav">
      <div className="container nav__inner">
        <Logo />
        <nav aria-label="Secciones" className="nav__links">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="nav__cta">
          <a href="#contacto" className="btn btn--primary btn--sm">
            Pedí tu demo
          </a>
          <button
            type="button"
            className="nav__menu"
            aria-label="Abrir menú"
            aria-haspopup="dialog"
            onClick={() => {
              setMenuLoaded(true);
              setOpen(true);
            }}
          >
            <Menu />
          </button>
          {menuLoaded ? (
            <Suspense fallback={null}>
              <MobileMenu open={open} onOpenChange={setOpen} />
            </Suspense>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero__bg" aria-hidden />
      <div className="container hero__inner">
        <p className="pill">
          <span className="pill__dot" aria-hidden />
          <span>
            Webs con turnos y pedidos online<span className="hide-sm"> para comercios y profesionales</span>
          </span>
        </p>
        <h1>
          Que te encuentren.
          <br />
          <span className="accent">Que te elijan.</span>
          <br />
          Que te reserven.
        </h1>
        <p className="hero__lead">
          Tu web con tu propia marca, turnos o pedidos online, y lista para aparecer en Google y en las respuestas de la
          IA. Te la mostramos armada antes de que pagues nada.
        </p>
        <div className="hero__ctas">
          <a href="#contacto" className="btn btn--primary btn--lg">
            Quiero ver mi demo gratis
            <ArrowRight width={18} height={18} />
          </a>
          {WHATSAPP ? (
            <a href={waLink(WA_DEFAULT_TEXT)} className="btn btn--ghost btn--lg" target="_blank" rel="noopener">
              <WhatsApp />
              Escribinos
            </a>
          ) : null}
        </div>
        <p className="hero__trust">
          <Sparkle width={16} height={16} />
          <span>
            Equipo con trayectoria en la industria del software, en empresas como <b>Facebook</b> y <b>Microsoft</b>.
          </span>
        </p>
      </div>
      <div className="container container--wide">
        <HeroStage />
      </div>
    </section>
  );
}

function Queries() {
  const row = [...QUERIES, ...QUERIES];
  return (
    <section className="queries" aria-labelledby="queries-title">
      <p className="queries__title" id="queries-title">
        Esto es lo que tus próximos clientes ya están buscando
      </p>
      <div className="marquee">
        <ul className="marquee__track">
          {row.map((q, i) => (
            <li key={`${q}-${i}`} aria-hidden={i >= QUERIES.length ? true : undefined}>
              <Search width={15} height={15} />
              {q}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="section" aria-labelledby="problema">
      <div className="container">
        <SectionHead
          eyebrow="El problema"
          title={
            <span id="problema">
              Instagram te da seguidores. <span className="muted">No te da una casa propia.</span>
            </span>
          }
          lead="Las redes y las apps de reservas sirven. Pero si todo tu negocio vive en la plataforma de otro, las reglas, la vidriera y los clientes también son de otro."
        />
        <div className="problems">
          {PROBLEMS.map((p) => {
            const Icon = ICONS[p.icon];
            return (
              <article key={p.title} className="card problem reveal">
                <span className="icon-chip icon-chip--muted">
                  <Icon />
                </span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section className="section section--tint" id="beneficios" aria-labelledby="beneficios-title">
      <div className="container">
        <SectionHead
          eyebrow="Lo que no se ve (y es lo que más vende)"
          title={<span id="beneficios-title">Una web linda es el principio. Lo importante es que te encuentren.</span>}
          lead="Cada web que hacemos viene preparada para buscadores y asistentes de IA desde el primer día. Sin que tengas que entender nada de esto."
        />
        <div className="bento">
          <article className="card bento__big reveal">
            <div className="bento__copy">
              <span className="icon-chip">
                <Search />
              </span>
              <h3>Aparecé cuando te buscan en Google</h3>
              <p>
                SEO local y tu Perfil de Empresa de Google completo: rubro, horarios, fotos, reseñas y un botón para
                reservar. Así aparecés en el mapa y en los resultados del barrio, con tu web detrás.
              </p>
            </div>
            <div className="bento__visual">
              <SearchMock />
            </div>
          </article>
          <article className="card bento__big bento__big--ai reveal">
            <div className="bento__copy">
              <span className="icon-chip">
                <Sparkle />
              </span>
              <h3>Que la IA te recomiende</h3>
              <p>
                Cada vez más gente le pregunta a ChatGPT, Gemini o Perplexity <i>“¿dónde hago tal cosa en tal barrio?”</i>.
                Preparamos tu web para que esas respuestas te puedan nombrar. Se llama <b>GEO</b>: optimización para
                buscadores con IA.
              </p>
              <ul className="geo">
                {GEO_POINTS.map((g) => (
                  <li key={g.k}>
                    <Check width={16} height={16} />
                    <span>
                      <b>{g.k}.</b> {g.v}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bento__visual">
              <AiChat />
              <p className="bento__note">Ejemplos ilustrativos: los negocios no existen.</p>
            </div>
          </article>
          {SMALL_BENEFITS.map((b) => {
            const Icon = ICONS[b.icon];
            return (
              <article key={b.title} className="card bento__small reveal">
                <span className="icon-chip">
                  <Icon />
                </span>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section className="section section--dark" id="ejemplo" aria-labelledby="ejemplo-title">
      <div className="showcase__glow" aria-hidden />
      <div className="container showcase">
        <div className="showcase__copy reveal">
          <p className="eyebrow eyebrow--light">Un ejemplo de cómo trabajamos</p>
          <h2 id="ejemplo-title">Así se ve una web nuestra antes de la primera charla.</h2>
          <p className="lead">
            Concepto para un estudio de uñas de Parque Chacabuco: portada con su estilo, servicios con precios y reserva
            de turnos en cuatro pasos, con horarios libres reales y un panel para el local.
          </p>
          <ul className="showcase__list">
            <li>
              <Calendar width={18} height={18} /> Reserva en 4 pasos, sin llamar ni escribir
            </li>
            <li>
              <Clock width={18} height={18} /> Horarios libres según la agenda real
            </li>
            <li>
              <Bolt width={18} height={18} /> Pensada para el celu: carga al instante
            </li>
            <li>
              <Shield width={18} height={18} /> Panel simple para ver y cancelar turnos
            </li>
          </ul>
          <p className="showcase__disclaimer">
            <span className="badge">Demo sin encargo</span> No es un cliente ni su sitio oficial: es la muestra que
            armamos para mostrar el trabajo.
          </p>
          {DEMO_URL ? (
            <a href={DEMO_URL} className="btn btn--light" target="_blank" rel="noopener">
              Ver la demo andando <ArrowRight width={18} height={18} />
            </a>
          ) : null}
        </div>
        <div className="showcase__visual reveal">
          <BrowserFrame url="tunegocio.com.ar" className="showcase__browser">
            <Picture
              name="selkis-desktop"
              widths={[640, 820, 1040, 1440]}
              ratio={1.6}
              sizes="(min-width: 1100px) 620px, 92vw"
              alt="Portada de la web de ejemplo en computadora"
            />
          </BrowserFrame>
          <PhoneFrame className="showcase__phone">
            <Picture
              name="selkis-mobile"
              widths={[300, 560]}
              ratio={780 / 1688}
              sizes="(min-width: 760px) 220px, 38vw"
              alt="Portada de la web de ejemplo en el celular, con botón de reservar turno"
            />
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}

function Process() {
  return (
    <section className="section" id="proceso" aria-labelledby="proceso-title">
      <div className="container">
        <SectionHead
          center
          eyebrow="Cómo trabajamos"
          title={
            <span id="proceso-title">
              Primero ves tu web.
              <br />
              <span className="accent">Después decidís.</span>
            </span>
          }
          lead="Sin reuniones eternas ni propuestas de veinte páginas. Te mostramos algo concreto y lo ajustamos con vos."
        />
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="step reveal">
              <span className="step__n">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="guarantee reveal">
          <span className="icon-chip icon-chip--solid">
            <Shield />
          </span>
          <div>
            <h3>Si no te gusta, no pagás.</h3>
            <p>La demo corre por nuestra cuenta. Y cuando arrancamos, la web y el dominio quedan a tu nombre.</p>
          </div>
          <a href="#contacto" className="btn btn--primary">
            Pedí tu demo <ArrowRight width={18} height={18} />
          </a>
        </div>
      </div>
    </section>
  );
}

function pickPlan(id: string) {
  window.dispatchEvent(new CustomEvent(PICK_PLAN_EVENT, { detail: id }));
}

function Packages() {
  return (
    <section className="section section--tint" id="paquetes" aria-labelledby="paquetes-title">
      <div className="container">
        <SectionHead
          center
          eyebrow="Paquetes"
          title={<span id="paquetes-title">Tres formas de arrancar. Precio cerrado, sin sorpresas.</span>}
          lead={
            SHOW_PRICES
              ? "Precios orientativos en pesos. Te pasamos el número final, por escrito, después de ver tu caso."
              : "Cada negocio es distinto: te pasamos el precio exacto, por escrito, en la primera charla. Sin costos por hora ni letra chica."
          }
        />
        <div className="plans">
          {PACKAGES.map((p) => (
            <article key={p.id} className={`plan reveal${p.featured ? " plan--featured" : ""}`}>
              {p.featured ? <span className="plan__flag">El más elegido para turnos</span> : null}
              <h3 className="plan__name">{p.name}</h3>
              <p className="plan__tagline">{p.tagline}</p>
              {SHOW_PRICES ? (
                <p className="plan__price">
                  <small>desde</small> {p.priceFrom}
                  <span>+ {p.monthlyFrom}/mes</span>
                </p>
              ) : (
                <p className="plan__for">{p.forWho}</p>
              )}
              <ul className="plan__list">
                {p.features.map((f) => (
                  <li key={f}>
                    <Check width={17} height={17} />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#contacto"
                className={`btn btn--block ${p.featured ? "btn--primary" : "btn--ghost"}`}
                onClick={() => pickPlan(p.id)}
              >
                {SHOW_PRICES ? "Lo quiero" : "Consultar precio"}
              </a>
            </article>
          ))}
        </div>
        <p className="plans__note reveal">
          Pagás recién cuando aprobás el diseño. Aparte, si lo necesitás: fotos profesionales, textos, campañas en Google
          y cobro online con Mercado Pago.
        </p>
      </div>
    </section>
  );
}

function MarkCell({ mark, note }: { mark: Mark; note?: string }) {
  const icon = mark === "yes" ? <Check width={18} height={18} /> : mark === "no" ? <Cross width={16} height={16} /> : <Minus width={16} height={16} />;
  const label = mark === "yes" ? "Sí" : mark === "no" ? "No" : "En parte";
  return (
    <td className={`cmp__cell cmp__cell--${mark}`}>
      <span className="cmp__mark" role="img" aria-label={label}>
        {icon}
      </span>
      {note ? <span className="cmp__note">{note}</span> : null}
    </td>
  );
}

function Compare() {
  return (
    <section className="section" aria-labelledby="comparacion-title">
      <div className="container">
        <SectionHead
          eyebrow="Web propia vs. alquilar vidriera"
          title={<span id="comparacion-title">Las plataformas son buenas agendas. El tema es dónde vive tu marca.</span>}
          lead="No hace falta elegir: si ya usás una agenda online y te funciona, la dejamos y cada botón “Reservar” de tu web la abre."
        />
        <div className="cmp reveal">
          <table>
            <caption className="sr-only">Comparación entre una web propia, un perfil en una plataforma de reservas y tener solo redes sociales</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Característica</span>
                </th>
                <th scope="col" className="cmp__own">
                  Web propia
                </th>
                <th scope="col">Perfil en una app de reservas</th>
                <th scope="col">Solo redes</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <MarkCell mark={r.own} />
                  <MarkCell mark={r.platform} note={r.platformNote} />
                  <MarkCell mark={r.social} note={r.socialNote} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="section section--tint" id="nosotros" aria-labelledby="nosotros-title">
      <div className="container about">
        <div className="about__copy reveal">
          <p className="eyebrow">Nosotros</p>
          <h2 id="nosotros-title">
            Experiencia de Big Tech, <span className="accent">para el negocio de la esquina.</span>
          </h2>
          <p className="lead">
            Somos un equipo de Buenos Aires con trayectoria en la industria del software, en empresas como Facebook y
            Microsoft. Ahí aprendimos a hacer productos rápidos, simples y que funcionan para muchísima gente.
          </p>
          <p>
            Hoy usamos esa experiencia para algo que nos importa: que la peluquería, el consultorio o la dietética de tu
            barrio tengan la misma visibilidad que una gran marca.
          </p>
          <ul className="about__exp" aria-label="Experiencia previa del equipo">
            <li>Facebook</li>
            <li>Microsoft</li>
            <li>Software a medida</li>
          </ul>
        </div>
        <div className="about__side">
          <blockquote className="mission reveal">
            <span className="mission__mark" aria-hidden>
              “
            </span>
            <p>Creemos que todos deberían tener acceso a la visibilidad en la web y a que la gente los conozca.</p>
            <footer>Nuestra misión</footer>
          </blockquote>
          <ul className="principles">
            {PRINCIPLES.map((p, i) => (
              <li key={p.title} className="reveal">
                <span className="principles__n">{i + 1}</span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="section" id="faq" aria-labelledby="faq-title">
      <div className="container faq">
        <SectionHead
          eyebrow="Preguntas frecuentes"
          title={<span id="faq-title">Lo que nos preguntan antes de arrancar.</span>}
          lead={
            <>
              ¿Te quedó otra duda? <a href="#contacto">Escribinos</a> y te respondemos sin vueltas.
            </>
          }
        />
        <Accordion.Root type="single" collapsible className="faq__list reveal" defaultValue="item-0">
          {FAQ.map((f, i) => (
            <Accordion.Item key={f.q} value={`item-${i}`} className="faq__item">
              <Accordion.Header asChild>
                <h3>
                  <Accordion.Trigger className="faq__trigger">
                    {f.q}
                    <span className="faq__plus" aria-hidden />
                  </Accordion.Trigger>
                </h3>
              </Accordion.Header>
              <Accordion.Content className="faq__content" forceMount>
                <p>{f.a}</p>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section className="section contact" id="contacto" aria-labelledby="contacto-title">
      <div className="contact__glow" aria-hidden />
      <div className="container contact__inner">
        <div className="contact__copy reveal">
          <p className="eyebrow">Contacto</p>
          <h2 id="contacto-title">
            Contanos de tu negocio.
            <br />
            <span className="accent">Te mostramos tu web.</span>
          </h2>
          <p className="lead">Dejanos tus datos y te escribimos para coordinar. La demo es gratis y sin compromiso.</p>
          <ul className="contact__channels">
            {WHATSAPP ? (
              <li>
                <a href={waLink(WA_DEFAULT_TEXT)} target="_blank" rel="noopener" className="channel">
                  <span className="channel__icon channel__icon--wa">
                    <WhatsApp />
                  </span>
                  <span>
                    <b>WhatsApp</b>
                    <small>La forma más rápida</small>
                  </span>
                  <ArrowRight width={18} height={18} />
                </a>
              </li>
            ) : null}
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="channel">
                <span className="channel__icon">
                  <Mail />
                </span>
                <span>
                  <b>{CONTACT_EMAIL}</b>
                  <small>Te respondemos en horario comercial</small>
                </span>
                <ArrowRight width={18} height={18} />
              </a>
            </li>
          </ul>
        </div>
        <div className="contact__form reveal">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <Logo />
          <p>Webs con turnos y pedidos para comercios y profesionales. Hecho en Buenos Aires.</p>
        </div>
        <nav aria-label="Pie de página" className="footer__links">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
          <a href="#contacto">Contacto</a>
        </nav>
      </div>
      <div className="container">
        <p className="footer__legal">
          © {new Date().getFullYear()} {BRAND_NAME}. Las webs que mostramos como ejemplo son conceptos, no clientes.
        </p>
      </div>
    </footer>
  );
}

/** Barra fija en el celu: aparece al pasar el hero y se esconde al llegar al formulario. */
function StickyCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.querySelector(".hero__ctas");
    const contact = document.getElementById("contacto");
    if (!hero || !contact) return;
    let pastHero = false;
    let atContact = false;
    const update = () => setShow(pastHero && !atContact);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) pastHero = !e.isIntersecting && e.boundingClientRect.top < 0;
        if (e.target === contact) atContact = e.isIntersecting;
      }
      update();
    });
    io.observe(hero);
    io.observe(contact);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`sticky${show ? " sticky--on" : ""}`} aria-hidden={!show}>
      <a href="#contacto" className="btn btn--primary btn--block" tabIndex={show ? 0 : -1}>
        Quiero ver mi demo gratis
      </a>
      {WHATSAPP ? (
        <a
          href={waLink(WA_DEFAULT_TEXT)}
          className="sticky__wa"
          target="_blank"
          rel="noopener"
          aria-label="Escribinos por WhatsApp"
          tabIndex={show ? 0 : -1}
        >
          <WhatsApp width={22} height={22} />
        </a>
      ) : null}
    </div>
  );
}

export function App() {
  return (
    <>
      <a href="#main" className="skip">
        Saltar al contenido
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Queries />
        <Problem />
        <Benefits />
        <Showcase />
        <Process />
        <Packages />
        <Compare />
        <About />
        <Faq />
        <Contact />
      </main>
      <Footer />
      <StickyCta />
    </>
  );
}
