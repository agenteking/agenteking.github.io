import type { MouseEvent } from "react";
import { SOURCE_LABEL, type LeadRow } from "../../../server/src/domain";
import { phoneLabel, relDate, rubroLabel, telHref, waLink } from "../format";
import { ChannelChip, DncBadge, Rating, StatusBadge, WebBadge } from "./Badges";
import { ChevronRight, Phone, WhatsApp } from "./Icons";

const stop = (e: MouseEvent) => e.stopPropagation();

function ContactButtons({ lead }: { lead: LeadRow }) {
  const tel = telHref(lead);
  const wa = waLink(lead);
  const label = phoneLabel(lead);
  if (!label) return <span className="muted">Sin teléfono</span>;
  return (
    <span className="phone">
      <span className="phone__num">{label}</span>
      <span className="phone__btns">
        {tel ? (
          <a className="icon-btn" href={tel} onClick={stop} aria-label={`Llamar a ${lead.name}`} title="Llamar">
            <Phone width={16} height={16} />
          </a>
        ) : null}
        {wa ? (
          <a
            className={`icon-btn icon-btn--wa${wa.probable ? " is-probable" : ""}`}
            href={wa.href}
            target="_blank"
            rel="noreferrer"
            onClick={stop}
            aria-label={`WhatsApp a ${lead.name}`}
            title={wa.probable ? "WhatsApp (probable: parece celular sin el 15)" : "WhatsApp"}
          >
            <WhatsApp width={16} height={16} />
          </a>
        ) : null}
      </span>
    </span>
  );
}

function LastContact({ lead }: { lead: LeadRow }) {
  if (!lead.last_contacted_at) return <span className="muted">Sin contactar</span>;
  return (
    <span className="last">
      <span className="last__when">{relDate(lead.last_contacted_at)}</span>
      {lead.last_channel ? <ChannelChip channel={lead.last_channel} by={lead.last_by} /> : null}
    </span>
  );
}

export function LeadTable({ leads, onOpen }: { leads: LeadRow[]; onOpen: (id: number) => void }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Comercio</th>
            <th>Barrio</th>
            <th>Teléfono</th>
            <th>Web</th>
            <th>Reseñas</th>
            <th>Estado</th>
            <th>Último contacto</th>
            <th>Origen</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr
              key={l.id}
              className={l.do_not_contact ? "is-dnc" : undefined}
              onClick={() => onOpen(l.id)}
              data-lead-id={l.id}
            >
              <td>
                <button
                  type="button"
                  className="lead-name"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(l.id);
                  }}
                >
                  {l.name}
                </button>
                <div className="sub">
                  {rubroLabel(l.rubro)}
                  {l.category ? ` · ${l.category}` : ""}
                </div>
                {l.do_not_contact ? <DncBadge /> : null}
              </td>
              <td>{l.barrio ?? <span className="muted">—</span>}</td>
              <td>
                <ContactButtons lead={l} />
              </td>
              <td>
                <WebBadge kind={l.website_kind} />
              </td>
              <td>
                <Rating rating={l.rating} reviews={l.reviews} />
              </td>
              <td>
                <StatusBadge status={l.status} />
              </td>
              <td>
                <LastContact lead={l} />
              </td>
              <td className="sub">{SOURCE_LABEL[l.source ?? ""] ?? l.source ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LeadCards({ leads, onOpen }: { leads: LeadRow[]; onOpen: (id: number) => void }) {
  return (
    <ul className="cards">
      {leads.map((l) => (
        <li key={l.id} className={`card${l.do_not_contact ? " is-dnc" : ""}`} data-lead-id={l.id}>
          <button type="button" className="card__main" onClick={() => onOpen(l.id)}>
            <span className="card__top">
              <span className="card__name">{l.name}</span>
              <ChevronRight width={16} height={16} />
            </span>
            <span className="sub">
              {rubroLabel(l.rubro)}
              {l.barrio ? ` · ${l.barrio}` : ""}
            </span>
            <span className="card__badges">
              <StatusBadge status={l.status} />
              <WebBadge kind={l.website_kind} />
              {l.do_not_contact ? <DncBadge /> : null}
            </span>
            <span className="card__meta">
              <Rating rating={l.rating} reviews={l.reviews} />
              <LastContact lead={l} />
            </span>
          </button>
          <div className="card__foot">
            <ContactButtons lead={l} />
          </div>
        </li>
      ))}
    </ul>
  );
}
