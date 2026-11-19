/**
 * Configuración de marca y contacto: TODO lo que cambia entre "demo" y "producción" está acá.
 * Se lee de variables VITE_* en el build (ver .env.example). Cambiar el nombre = VITE_BRAND_NAME + npm run build.
 */
const env = import.meta.env;

/** Nombre provisorio de la marca (placeholder hasta que los socios elijan). */
export const BRAND_NAME: string = env.VITE_BRAND_NAME || "Aparece";
export const SITE_URL: string = (env.VITE_SITE_URL || "https://aparece.com.ar").replace(/\/$/, "");
export const SITE_DOMAIN: string = SITE_URL.replace(/^https?:\/\//, "");
export const CONTACT_EMAIL: string = env.VITE_CONTACT_EMAIL || `hola@${SITE_DOMAIN}`;
/** Formato internacional, solo dígitos (5491100000000). Vacío = se oculta WhatsApp. */
export const WHATSAPP: string = (env.VITE_WHATSAPP || "").replace(/\D/g, "");
/** true mientras es demo: meta robots noindex. Poné VITE_NOINDEX=0 al publicar. */
export const NOINDEX: boolean = env.VITE_NOINDEX !== "0";
/** Precios "desde" orientativos en los paquetes (off por defecto: ver README). */
export const SHOW_PRICES: boolean = env.VITE_SHOW_PRICES === "1";
/** Link opcional a la demo navegable del caso de ejemplo. */
export const DEMO_URL: string = env.VITE_DEMO_URL || "";

export const CITY = "Buenos Aires";

export function waLink(text: string): string {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
}

export const WA_DEFAULT_TEXT = `Hola ${BRAND_NAME}! Tengo un negocio y me gustaría ver cómo quedaría mi web.`;
