import { BRAND_NAME } from "./config";

/** Búsquedas reales del tipo que hace la gente (ejemplos genéricos, rubros y barrios variados). */
export const QUERIES = [
  "peluquería en Caballito abierta el sábado",
  "veterinaria cerca de Villa Crespo con turno",
  "pilates reformer en Palermo para principiantes",
  "odontólogo de urgencia en Flores",
  "dietética sin TACC en Belgrano",
  "barbería en Colegiales con turno online",
  "kinesiólogo en Núñez que atienda tarde",
  "clases de yoga en San Telmo",
  "psicóloga en Almagro presencial",
  "estética facial en Villa Urquiza",
  "panadería con pedidos online en Boedo",
  "manicura en Parque Chacabuco",
];

/** Ejemplos que rota el mockup del asistente de IA (ilustrativos: los negocios no existen). */
export const AI_EXAMPLES = [
  {
    q: "¿Dónde hago pilates reformer en Palermo? Soy principiante.",
    name: "Estudio Reformer",
    detail: "tiene clases para principiantes de lunes a sábado, grupos chicos y reservás el turno online.",
    url: "estudioreformer.com.ar",
  },
  {
    q: "Veterinaria en Villa Crespo que atienda el sábado",
    name: "Veterinaria del Parque",
    detail: "abre los sábados de 9 a 14, publica sus precios de consulta y podés pedir turno desde la web.",
    url: "veterinariadelparque.com.ar",
  },
  {
    q: "Una peluquería en Caballito con buenas reseñas para corte y color",
    name: "Salón Rivadavia",
    detail: "tiene más de 300 reseñas, muestra sus trabajos de color y toma turnos online las 24 h.",
    url: "salonrivadavia.com.ar",
  },
  {
    q: "Dietética en Belgrano con productos sin TACC y envío",
    name: "Granero Belgrano",
    detail: "tiene catálogo sin TACC con precios, hace envíos en el barrio y recibe pedidos por la web.",
    url: "granerobelgrano.com.ar",
  },
] as const;

export const PROBLEMS = [
  {
    title: "Los DMs no son una agenda.",
    text: "Consultas que se pierden, turnos que se pisan y vos contestando precios a las 11 de la noche.",
    icon: "chat",
  },
  {
    title: "En las plataformas, la competencia está al lado.",
    text: "Los marketplaces muestran otros locales cerca, con precio y estrellas. El que te buscaba a vos, termina en otro lado.",
    icon: "grid",
  },
  {
    title: "Si no aparecés en Google, no existís para el que no te conoce.",
    text: "La gente nueva no busca tu @. Busca “pilates en Palermo” o “veterinaria abierta hoy”. Y elige entre los que aparecen.",
    icon: "search",
  },
] as const;

export const GEO_POINTS = [
  { k: "Datos estructurados", v: "Schema.org LocalBusiness: rubro, dirección, horarios y servicios en el idioma que leen las máquinas." },
  { k: "Contenido claro", v: "Qué hacés, para quién, cuánto sale y dónde. Respuestas concretas, fáciles de citar." },
  { k: "Reseñas", v: "Te ayudamos a pedirlas y a mostrarlas. Son la señal de confianza que más pesa." },
  { k: "Mismos datos en todos lados", v: "Nombre, dirección y teléfono idénticos en tu web, Google, Instagram y directorios." },
] as const;

export const SMALL_BENEFITS = [
  {
    icon: "brand",
    title: "Tu marca, tu dominio",
    text: "tunegocio.com.ar, con tu diseño y tus fotos. No una ficha más dentro de la página de otro.",
  },
  {
    icon: "data",
    title: "Tus clientes son tuyos",
    text: "Cada reserva y cada consulta queda en tu base. Te la llevás en una planilla cuando quieras.",
  },
  {
    icon: "clock",
    title: "Turnos y pedidos 24 h",
    text: "Te reservan mientras dormís o atendés. Sin ida y vuelta por chat, sin turnos pisados.",
  },
  {
    icon: "bolt",
    title: "Rápida en el celu",
    text: "Hecha a medida y liviana: abre al toque con datos móviles, que es desde donde te buscan.",
  },
] as const;

export const STEPS = [
  {
    title: "Charlamos 15 minutos",
    text: "Nos contás cómo trabajás hoy, o miramos juntos tu Instagram y tu ficha de Google.",
  },
  {
    title: "Te mostramos tu web armada",
    text: "Con tu nombre, tus servicios y tus fotos. La ves andando en tu celu antes de pagar nada.",
  },
  {
    title: "Ajustamos y publicamos",
    text: "Cambiamos lo que quieras y la ponemos online con tu dominio, en días, no en meses.",
  },
  {
    title: "Te acompañamos",
    text: "Google, reseñas, cambios de precios o fotos. Vos seguís con lo tuyo; nosotros, con lo nuestro.",
  },
] as const;

export interface Package {
  id: "vidriera" | "turnos" | "tranqui";
  name: string;
  tagline: string;
  forWho: string;
  features: string[];
  featured?: boolean;
  /** Orientativos (propuesta sugerida, a validar por los socios). Solo se muestran con VITE_SHOW_PRICES=1. */
  priceFrom: string;
  monthlyFrom: string;
}

/** El más completo primero (anclaje) y el del medio recomendado. */
export const PACKAGES: Package[] = [
  {
    id: "tranqui",
    name: "Tranqui",
    tagline: "Todo resuelto, todos los meses.",
    forWho: "Para el que no quiere ocuparse nunca más de la web.",
    features: [
      "Todo lo de Turnos",
      "Seña online al reservar",
      "Recordatorios por WhatsApp",
      "Gift cards y pedido de reseñas",
      "2 cambios por mes (precios, fotos, promos)",
      "Reporte mensual de visitas y reservas",
    ],
    priceFrom: "$590.000",
    monthlyFrom: "$69.900",
  },
  {
    id: "turnos",
    name: "Turnos",
    tagline: "Tu web + reservas online.",
    forWho: "Para el que vive de turnos o pedidos.",
    features: [
      "Todo lo de Vidriera",
      "Reservas con calendario y horarios reales",
      "Catálogo o menú editable",
      "Avisos de cada reserva por mail o WhatsApp",
      "Panel simple para ver y cancelar turnos",
    ],
    featured: true,
    priceFrom: "$390.000",
    monthlyFrom: "$39.900",
  },
  {
    id: "vidriera",
    name: "Vidriera",
    tagline: "Tu casa propia en internet.",
    forWho: "Para el que quiere estar y que lo encuentren.",
    features: [
      "Web a medida con tu dominio",
      "Botón de WhatsApp, mapa y horarios",
      "Ficha de Google completa y optimizada",
      "Datos estructurados para Google y la IA",
      "Hosting y 1 cambio por mes",
    ],
    priceFrom: "$250.000",
    monthlyFrom: "$25.000",
  },
];

export type Mark = "yes" | "no" | "partial";

export const COMPARE: { label: string; own: Mark; platform: Mark; social: Mark; platformNote?: string; socialNote?: string }[] = [
  { label: "Tu dominio y tu marca", own: "yes", platform: "partial", platformNote: "Ficha o subdominio de la plataforma", social: "partial", socialNote: "Tu @ dentro de la red" },
  { label: "Sin otros locales al lado", own: "yes", platform: "no", platformNote: "Suelen sugerir locales cercanos", social: "partial", socialNote: "Decide el algoritmo" },
  { label: "Los datos de tus clientes son tuyos", own: "yes", platform: "partial", platformNote: "Según los términos de cada una", social: "no" },
  { label: "Sin comisión por cliente nuevo", own: "yes", platform: "partial", platformNote: "Algunas cobran por cliente nuevo", social: "yes" },
  { label: "Turnos online las 24 h", own: "yes", platform: "yes", social: "no", socialNote: "Por DM, cuando contestás" },
  { label: "Diseño a medida", own: "yes", platform: "no", platformNote: "Plantilla igual para todos", social: "no", socialNote: "Grilla de fotos" },
];

export const PRINCIPLES = [
  { title: "Te hablamos claro", text: "Sin jerga ni letra chica. Precio cerrado y por escrito antes de arrancar." },
  { title: "Software de verdad", text: "Código a medida, no plantillas de arrastrar y soltar: rápido, seguro y medible." },
  { title: "Lo tuyo es tuyo", text: "Dominio, web y datos a tu nombre. Si un día te vas, te llevás todo." },
] as const;

export const FAQ = [
  {
    q: "¿Cuánto sale?",
    a: "Depende de lo que necesites: una web vidriera, una con turnos o pedidos, o todo resuelto con abono mensual. Siempre es precio cerrado y por escrito, sin costos por hora. Escribinos y en la primera charla te pasamos el número exacto para tu caso.",
  },
  {
    q: "¿Tengo que pagar antes de ver algo?",
    a: "No. Primero te mostramos tu web armada, con tu nombre y tus servicios. Si te gusta, arrancamos. Si no, no pagás.",
  },
  {
    q: "¿Cuánto tarda?",
    a: "La primera versión la ves en pocos días. Una vez que la aprobás, publicarla con tu dominio lleva en general alrededor de una semana, según cuánto contenido haya que preparar.",
  },
  {
    q: "No sé nada de tecnología. ¿Es un problema?",
    a: "Para nada. Usamos tus fotos y lo que ya publicás. Vos solo aprobás. Si después querés cambiar algo, nos mandás un mensaje.",
  },
  {
    q: "Ya tengo Instagram. ¿Para qué quiero una web?",
    a: "Instagram es buenísimo para los que ya te siguen. La web es para los que todavía no te conocen y te buscan en Google o le preguntan a una IA. Tu web toma lo mejor de tu Instagram y lo pone donde busca la gente nueva.",
  },
  {
    q: "Ya uso una agenda online. ¿Tengo que cambiarla?",
    a: "No. Si te funciona, la dejamos: hacemos tu web con tu marca y cada botón de “Reservar” abre tu agenda actual. Si preferís una propia, también la armamos.",
  },
  {
    q: "¿Me garantizan salir primero en Google?",
    a: "Nadie puede garantizar eso, y desconfiá de quien lo prometa. Lo que sí hacemos es todo lo que depende de nosotros: una web rápida y clara, tu ficha de Google completa, datos estructurados y los mismos datos en todos lados. Eso es lo que Google y los asistentes de IA tienen en cuenta.",
  },
  {
    q: "¿Qué es eso de que la IA me recomiende?",
    a: "Cada vez más gente le pregunta a ChatGPT, Gemini o Perplexity “dónde hago tal cosa en tal barrio”. Esos asistentes arman la respuesta con lo que encuentran en la web. Si tu información está clara, ordenada y es consistente, tenés más chances de aparecer. A eso se le dice GEO: optimización para buscadores con IA.",
  },
  {
    q: "¿De quién es la web?",
    a: "Tuya. El dominio se registra a tu nombre y los datos de tus clientes son tuyos. Si algún día querés irte, te llevás todo.",
  },
  {
    q: "¿Trabajan solo en CABA?",
    a: `Somos de ${"Buenos Aires"} y nos encanta ir al local, pero trabajamos con negocios de cualquier lugar por videollamada.`,
  },
] as const;

export const NAV = [
  { href: "#beneficios", label: "Beneficios" },
  { href: "#ejemplo", label: "Ejemplo" },
  { href: "#proceso", label: "Cómo trabajamos" },
  { href: "#paquetes", label: "Paquetes" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#faq", label: "Preguntas" },
] as const;

export const SEO = {
  title: `${BRAND_NAME} · Webs con turnos y pedidos para comercios y profesionales`,
  description:
    "Hacemos webs premium para comercios y profesionales de barrio, con turnos y pedidos online. Que te encuentren en Google y que la IA te recomiende, con tu propia marca. Te mostramos tu web antes de pagar.",
};
