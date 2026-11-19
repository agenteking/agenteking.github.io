import Database from "better-sqlite3";
import type { Channel, LeadDetail, LeadRow, Partner, Status, Touch } from "./domain.js";

/**
 * Acceso directo (SQL) a la base de leads. El esquema es de `leads.py` (CLI del agente): acá no se
 * crean ni migran tablas, solo se lee y se escribe con la misma lógica que la CLI
 * (`touch`, `set-status`, `update`), así la web y la CLI quedan siempre en sync.
 */

const MIN_SCHEMA = 2;

export function openDb(file: string): Database.Database {
  const db = new Database(file, { fileMustExist: true, timeout: 10_000 });
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const v = (db.prepare("SELECT MAX(version) AS v FROM schema_version").get() as { v: number | null }).v ?? 0;
  if (v < MIN_SCHEMA) {
    throw new Error(
      `La base ${file} está en schema_version ${v} y el back office necesita ${MIN_SCHEMA}: corré "python3 leads.py init" primero.`,
    );
  }
  return db;
}

/** Igual que `now_iso()` de leads.py: hora de Buenos Aires con offset, sin milisegundos. */
export function nowIso(d = new Date()): string {
  const art = new Date(d.getTime() - 3 * 3600_000);
  return `${art.toISOString().slice(0, 19)}-03:00`;
}

const LIST_COLS = `l.id, l.name, l.category, l.rubro, l.address, l.barrio, l.phone, l.phone_norm, l.whatsapp,
  l.email, l.website, l.website_kind, l.instagram, l.facebook, l.rating, l.reviews, l.maps_url, l.source,
  l.status, l.do_not_contact, l.no_llame_listed, l.first_contacted_at, l.last_contacted_at, l.created_at,
  (SELECT t.channel FROM touches t WHERE t.lead_id = l.id ORDER BY t.at DESC, t.id DESC LIMIT 1) AS last_channel,
  (SELECT t.by FROM touches t WHERE t.lead_id = l.id ORDER BY t.at DESC, t.id DESC LIMIT 1) AS last_by,
  (SELECT COUNT(*) FROM touches t WHERE t.lead_id = l.id) AS touches_count`;

export class LeadsRepo {
  constructor(private db: Database.Database) {}

  list(): LeadRow[] {
    return this.db.prepare(`SELECT ${LIST_COLS} FROM leads l ORDER BY l.id DESC`).all() as LeadRow[];
  }

  get(id: number): LeadDetail | null {
    const row = this.db
      .prepare(
        `SELECT ${LIST_COLS}, l.lat, l.lng, l.website_notes, l.booking_url, l.other_socials, l.search_query,
          l.no_llame_checked_at, l.notes, l.updated_at,
          (SELECT COUNT(*) FROM deals d WHERE d.lead_id = l.id) AS deals_count,
          (SELECT COUNT(*) FROM payments p WHERE p.lead_id = l.id) AS payments_count
        FROM leads l WHERE l.id = ?`,
      )
      .get(id) as Omit<LeadDetail, "touches"> | undefined;
    if (!row) return null;
    const touches = this.db
      .prepare("SELECT id, at, channel, by, summary, outcome FROM touches WHERE lead_id = ? ORDER BY at DESC, id DESC")
      .all(id) as Touch[];
    return { ...row, touches };
  }

  /** = leads.py add_touch: inserta el toque, nuevo→contactado, primera/última fecha de contacto. */
  addTouch(
    id: number,
    t: { channel: Channel; by: Partner; summary?: string | null; outcome?: string | null; at?: string },
  ): boolean {
    const tx = this.db.transaction(() => {
      const row = this.db.prepare("SELECT status FROM leads WHERE id = ?").get(id) as { status: Status } | undefined;
      if (!row) return false;
      const at = t.at ?? nowIso();
      this.db
        .prepare("INSERT INTO touches (lead_id, at, channel, by, summary, outcome) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, at, t.channel, t.by, t.summary || null, t.outcome || null);
      const status: Status = row.status === "nuevo" ? "contactado" : row.status;
      this.db
        .prepare(
          `UPDATE leads SET status = ?, first_contacted_at = COALESCE(first_contacted_at, ?),
             last_contacted_at = ?, updated_at = ? WHERE id = ?`,
        )
        .run(status, at, at, nowIso(), id);
      return true;
    });
    return tx();
  }

  /** = leads.py set_status: cambia el estado y, si hay nota, la agrega con fecha a las notas. */
  setStatus(id: number, status: Status, note?: string | null): boolean {
    const tx = this.db.transaction(() => {
      const row = this.db.prepare("SELECT notes FROM leads WHERE id = ?").get(id) as { notes: string | null } | undefined;
      if (!row) return false;
      this.db
        .prepare("UPDATE leads SET status = ?, notes = ?, updated_at = ? WHERE id = ?")
        .run(status, appendNote(row.notes, note), nowIso(), id);
      return true;
    });
    return tx();
  }

  /**
   * Pidió la baja: como `leads.py set-status --status descartado --do-not-contact`.
   * Sacar la marca (value=false) deja el estado como está.
   */
  setDoNotContact(id: number, value: boolean, note?: string | null): boolean {
    const tx = this.db.transaction(() => {
      const row = this.db.prepare("SELECT notes FROM leads WHERE id = ?").get(id) as { notes: string | null } | undefined;
      if (!row) return false;
      if (value) {
        this.db
          .prepare("UPDATE leads SET status = 'descartado', do_not_contact = 1, notes = ?, updated_at = ? WHERE id = ?")
          .run(appendNote(row.notes, note || "Pidió que no lo contactemos"), nowIso(), id);
      } else {
        this.db
          .prepare("UPDATE leads SET do_not_contact = 0, notes = ?, updated_at = ? WHERE id = ?")
          .run(appendNote(row.notes, note || "Se sacó la marca de no contactar"), nowIso(), id);
      }
      return true;
    });
    return tx();
  }

  /** = leads.py update con {"notes": ...}: pisa las notas. */
  setNotes(id: number, notes: string | null): boolean {
    const r = this.db.prepare("UPDATE leads SET notes = ?, updated_at = ? WHERE id = ?").run(notes || null, nowIso(), id);
    return r.changes > 0;
  }
}

function appendNote(notes: string | null, note?: string | null): string | null {
  if (!note) return notes;
  return `${notes ? `${notes}\n` : ""}[${nowIso().slice(0, 10)}] ${note}`;
}
