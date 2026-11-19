import type { Channel, LeadDetail, LeadRow, Partner, Status } from "../../server/src/domain";

export class Unauthorized extends Error {}

async function call<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    credentials: "same-origin",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Unauthorized();
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string; issues?: string[] };
      msg = j.issues?.join(", ") || j.error || msg;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const api = {
  leads: () => call<{ leads: LeadRow[] }>("/api/leads").then((r) => r.leads),
  lead: (id: number) => call<{ lead: LeadDetail }>(`/api/leads/${id}`).then((r) => r.lead),
  touch: (id: number, body: { channel: Channel; by: Partner; summary?: string; outcome?: string }) =>
    call<{ lead: LeadDetail }>(`/api/leads/${id}/touches`, { method: "POST", body }).then((r) => r.lead),
  status: (id: number, status: Status, note?: string) =>
    call<{ lead: LeadDetail }>(`/api/leads/${id}/status`, { method: "POST", body: { status, note } }).then((r) => r.lead),
  doNotContact: (id: number, value: boolean, note?: string) =>
    call<{ lead: LeadDetail }>(`/api/leads/${id}/do-not-contact`, { method: "POST", body: { value, note } }).then(
      (r) => r.lead,
    ),
  notes: (id: number, notes: string) =>
    call<{ lead: LeadDetail }>(`/api/leads/${id}`, { method: "PATCH", body: { notes } }).then((r) => r.lead),
};
