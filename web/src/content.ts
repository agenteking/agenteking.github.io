// Datos públicos del local (fuentes en docs/analisis.md) y textos del sitio.

export const DEMO_BRAND = import.meta.env.VITE_DEMO_BRAND ?? "KingKanel";

export const business = {
  name: "Selkis Estudio",
  tagline: "Salón de uñas, cejas, pestañas y láser",
  address: "Av. Directorio 100",
  area: "Parque Chacabuco, CABA",
  phoneDisplay: "11 3420-8344",
  whatsapp: "5491134208344",
  instagram: "https://www.instagram.com/selkisestudio/",
  instagramHandle: "@selkisestudio",
  facebook: "https://www.facebook.com/selkisestudio",
  maps: "https://www.google.com/maps/search/?api=1&query=Selkis+Estudio+U%C3%B1as+Av.+Directorio+100+CABA",
  rating: "4,7",
  reviewsCount: 195,
};

export const waLink = (text = "Hola Selkis! Quería consultar por un turno 💅") =>
  `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(text)}`;

export const weekdayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Reseñas reales de Google Maps (citadas textual, extractos). Fuente: top-rated.online (Google Maps), nov-2026.
export const reviews = [
  {
    author: "Carmen G.",
    text: "Muy profesionales y amables las chicas que atienden […] me encantó que respetan el horario. Super recomendable.",
  },
  {
    author: "Iardena S.",
    text: "Usan muy buenos productos. Hacen varias capas […] Las chicas son muy profesionales, hacen art nails súper bien.",
  },
  {
    author: "Andrea A.",
    text: "Son todo lo que está bien […] Muy buenos productos, realizó manos y depilación y siempre conforme.",
  },
];

export const faqs = [
  {
    q: "¿Atienden sin turno?",
    a: "Trabajamos con turno para dedicarte el tiempo que tu servicio necesita. Desde acá lo reservás en un minuto, a cualquier hora.",
  },
  {
    q: "¿Cuánto dura el kapping?",
    a: "Con buen cuidado, nuestras clientas cuentan que el kapping les dura hasta 20 días impecable.",
  },
  {
    q: "¿Puedo llevar un diseño?",
    a: "¡Sí! Mandanos la foto por WhatsApp antes del turno así elegimos el servicio y el tiempo justo para tu nail art.",
  },
  {
    q: "¿Cómo cancelo o cambio un turno?",
    a: "Escribinos por WhatsApp con tu código de reserva y lo reprogramamos.",
  },
];
