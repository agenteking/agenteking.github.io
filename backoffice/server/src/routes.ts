import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { LeadsRepo } from "./db.js";
import { CHANNELS, PARTNERS, STATUSES } from "./domain.js";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null)
    .nullish();

const TouchBody = z.object({
  channel: z.enum(CHANNELS),
  by: z.enum(PARTNERS),
  summary: text(1000),
  outcome: text(500),
});
const StatusBody = z.object({ status: z.enum(STATUSES), note: text(1000) });
const DncBody = z.object({ value: z.boolean(), note: text(1000) });
const NotesBody = z.object({ notes: z.string().max(10_000).nullable() });

function leadId(req: Request, res: Response): number | null {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "bad_id" });
    return null;
  }
  return id;
}

function parse<T>(schema: z.ZodType<T>, req: Request, res: Response): T | null {
  const r = schema.safeParse(req.body);
  if (!r.success) {
    res.status(400).json({ error: "bad_request", issues: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
    return null;
  }
  return r.data;
}

export function api(repo: LeadsRepo): Router {
  const r = Router();

  r.get("/session", (_req, res) => {
    res.json({ ok: true });
  });

  r.get("/leads", (_req, res) => {
    res.json({ leads: repo.list() });
  });

  r.get("/leads/:id", (req, res) => {
    const id = leadId(req, res);
    if (id === null) return;
    const lead = repo.get(id);
    if (!lead) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ lead });
  });

  const reply = (res: Response, id: number, ok: boolean) => {
    if (!ok) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ lead: repo.get(id) });
  };

  r.post("/leads/:id/touches", (req, res) => {
    const id = leadId(req, res);
    const body = id === null ? null : parse(TouchBody, req, res);
    if (id === null || !body) return;
    reply(res, id, repo.addTouch(id, body));
  });

  r.post("/leads/:id/status", (req, res) => {
    const id = leadId(req, res);
    const body = id === null ? null : parse(StatusBody, req, res);
    if (id === null || !body) return;
    reply(res, id, repo.setStatus(id, body.status, body.note));
  });

  r.post("/leads/:id/do-not-contact", (req, res) => {
    const id = leadId(req, res);
    const body = id === null ? null : parse(DncBody, req, res);
    if (id === null || !body) return;
    reply(res, id, repo.setDoNotContact(id, body.value, body.note));
  });

  r.patch("/leads/:id", (req, res) => {
    const id = leadId(req, res);
    const body = id === null ? null : parse(NotesBody, req, res);
    if (id === null || !body) return;
    reply(res, id, repo.setNotes(id, body.notes?.trim() || null));
  });

  return r;
}
