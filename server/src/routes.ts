import { Router, type Request } from "express";
import { contactSchema, fieldErrors } from "./contact-schema.js";
import { prisma } from "./db.js";

export const api = Router();

// Límite simple por IP para el formulario: 5 envíos cada 10 minutos (en memoria, alcanza para una landing).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(req: Request): boolean {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

api.get("/health", (_req, res) => {
  res.json({ ok: true });
});

api.post("/contact", async (req, res) => {
  if (rateLimited(req)) {
    res.status(429).json({ error: "too_many_requests", message: "Recibimos varios envíos seguidos. Probá en unos minutos o escribinos por WhatsApp." });
    return;
  }
  const parsed = contactSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid", fields: fieldErrors(parsed.error) });
    return;
  }
  const { website, ...data } = parsed.data;
  // Honeypot completo = bot. Respondemos OK para no darle pistas, pero no guardamos nada.
  if (website) {
    res.status(201).json({ ok: true });
    return;
  }
  const lead = await prisma.lead.create({ data });
  console.log(`[contact] nueva consulta ${lead.id} · ${lead.business}`);
  res.status(201).json({ ok: true, id: lead.id });
});

/** Admin: últimas consultas. Header x-admin-key = ADMIN_KEY. */
api.get("/contacts", async (req, res) => {
  const key = process.env.ADMIN_KEY;
  if (!key || req.get("x-admin-key") !== key) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json({ leads });
});
