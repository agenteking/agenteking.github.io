import { z } from "zod";

/**
 * Validación del formulario de contacto. La usan el server (POST /api/contact) y el front
 * (se importa en forma diferida al enviar, para no sumar zod a la carga inicial).
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const PLANS = ["light", "standard", "pro", "nose"] as const;
export type Plan = (typeof PLANS)[number];

const emailCheck = z.email();

export const contactSchema = z
  .object({
    name: z.string({ error: "Decinos cómo te llamás" }).trim().min(2, "Decinos cómo te llamás").max(80, "Máximo 80 caracteres"),
    business: z.string({ error: "¿Cómo se llama tu negocio?" }).trim().min(2, "¿Cómo se llama tu negocio?").max(120, "Máximo 120 caracteres"),
    rubro: optionalText(60),
    barrio: optionalText(60),
    phone: optionalText(30),
    email: optionalText(120),
    message: optionalText(1500),
    plan: z.enum(PLANS).optional(),
    /** Honeypot: los humanos no lo ven ni lo completan. */
    website: z.string().max(200).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.phone && !v.email) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Dejanos un WhatsApp o un email para responderte" });
      return;
    }
    if (v.phone) {
      const digits = v.phone.replace(/\D/g, "");
      if (!/^[+\d\s().-]+$/.test(v.phone) || digits.length < 8 || digits.length > 15) {
        ctx.addIssue({ code: "custom", path: ["phone"], message: "Revisá el número (ej. 11 2345 6789)" });
      }
    }
    if (v.email && !emailCheck.safeParse(v.email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Revisá el email" });
    }
  });

export type ContactInput = z.input<typeof contactSchema>;
export type ContactData = z.output<typeof contactSchema>;

/** Primer mensaje de error por campo (para mostrar debajo de cada input). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
