import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  CHANNELS,
  CHANNEL_LABEL,
  PARTNERS,
  SOURCE_LABEL,
  STATUSES,
  STATUS_LABEL,
  type Channel,
  type LeadDetail,
  type Partner,
  type Status,
} from "../../../server/src/domain";
import { api } from "../api";
import {
  igHandle,
  longDate,
  mapsHref,
  phoneLabel,
  relDate,
  rubroLabel,
  shortAddress,
  shortUrl,
  telHref,
  waLink,
} from "../format";
import { ChannelChip, DncBadge, Rating, StatusBadge, WebBadge } from "./Badges";
import { Ban, CHANNEL_ICON, Check, Close, Facebook, Globe, Instagram, Mail, Note, Phone, Pin, Wallet, WhatsApp } from "./Icons";

interface Props {
  id: number | null;
  me: Partner;
  onClose: () => void;
  onChanged: (msg: string) => void;
  onError: (msg: string) => void;
}

export function LeadDrawer({ id, me, onClose, onChanged, onError }: Props) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id == null) {
      setLead(null);
      return;
    }
    let alive = true;
    setLoading(true);
    api
      .lead(id)
      .then((l) => alive && setLead(l))
      .catch((e: Error) => alive && onError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, onError]);

  const apply = async (p: Promise<LeadDetail>, msg: string) => {
    try {
      setLead(await p);
      onChanged(msg);
      return true;
    } catch (e) {
      onError((e as Error).message);
      return false;
    }
  };

  return (
    <Dialog.Root open={id != null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="drawer" aria-describedby={undefined}>
          {!lead || lead.id !== id ? (
            <div className="drawer__loading">
              <Dialog.Title className="sr-only">Cargando lead</Dialog.Title>
              {loading ? <span className="spinner" aria-label="Cargando" /> : null}
            </div>
          ) : (
            <DrawerBody lead={lead} me={me} apply={apply} />
          )}
          <Dialog.Close className="drawer__close icon-btn" aria-label="Cerrar">
            <Close />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type Apply = (p: Promise<LeadDetail>, msg: string) => Promise<boolean>;

function DrawerBody({ lead, me, apply }: { lead: LeadDetail; me: Partner; apply: Apply }) {
  const wa = waLink(lead);
  const tel = telHref(lead);
  const maps = mapsHref(lead);
  return (
    <div className="drawer__body">
      <header className="drawer__head">
        <div className="eyebrow">
          {rubroLabel(lead.rubro)}
          {lead.barrio ? ` · ${lead.barrio}` : ""}
        </div>
        <Dialog.Title className="drawer__title">{lead.name}</Dialog.Title>
        {lead.category ? <p className="sub">{lead.category}</p> : null}
        <div className="drawer__badges">
          <StatusBadge status={lead.status} />
          <WebBadge kind={lead.website_kind} />
          {lead.do_not_contact ? <DncBadge /> : null}
          <Rating rating={lead.rating} reviews={lead.reviews} />
        </div>
        <div className="quick">
          {tel ? (
            <a className="quick__btn" href={tel}>
              <Phone /> Llamar
            </a>
          ) : null}
          {wa ? (
            <a className="quick__btn quick__btn--wa" href={wa.href} target="_blank" rel="noreferrer">
              <WhatsApp /> WhatsApp{wa.probable ? "?" : ""}
            </a>
          ) : null}
          {lead.email ? (
            <a className="quick__btn" href={`mailto:${lead.email}`}>
              <Mail /> Mail
            </a>
          ) : null}
          {lead.instagram ? (
            <a className="quick__btn" href={lead.instagram} target="_blank" rel="noreferrer">
              <Instagram /> Instagram
            </a>
          ) : null}
          {maps ? (
            <a className="quick__btn" href={maps} target="_blank" rel="noreferrer">
              <Pin /> Maps
            </a>
          ) : null}
        </div>
        {lead.do_not_contact ? (
          <p className="alert alert--dnc">
            <Ban width={16} height={16} /> Pidió que no lo contactemos. No le escribas ni lo llames.
          </p>
        ) : lead.no_llame_listed ? (
          <p className="alert">Está en el Registro No Llame: solo mail o visita.</p>
        ) : null}
      </header>

      <TouchForm key={`t-${lead.id}`} lead={lead} me={me} apply={apply} />

      <Section title="Estado">
        <StatusPicker lead={lead} apply={apply} />
        <DncToggle lead={lead} apply={apply} />
      </Section>

      <Section title="Historial de contacto" count={lead.touches.length}>
        {lead.touches.length === 0 ? (
          <p className="empty-line">Todavía nadie lo contactó.</p>
        ) : (
          <ol className="timeline">
            {lead.touches.map((t) => {
              const Icon = CHANNEL_ICON[t.channel] ?? Note;
              return (
                <li key={t.id} className="timeline__item" data-touch-id={t.id}>
                  <span className="timeline__dot">
                    <Icon width={15} height={15} />
                  </span>
                  <div>
                    <div className="timeline__head">
                      <ChannelChip channel={t.channel} by={t.by} />
                      <time dateTime={t.at} title={longDate(t.at)}>
                        {relDate(t.at)} · {longDate(t.at)}
                      </time>
                    </div>
                    {t.summary ? <p>{t.summary}</p> : null}
                    {t.outcome ? <p className="timeline__outcome">Resultado: {t.outcome}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title="Notas">
        <NotesEditor key={`n-${lead.id}`} lead={lead} apply={apply} />
      </Section>

      <Section title="Datos de contacto">
        <dl className="facts">
          <Fact label="Dirección" icon={<Pin />}>
            {lead.address ? (
              maps ? (
                <a href={maps} target="_blank" rel="noreferrer">
                  {shortAddress(lead.address)}
                </a>
              ) : (
                shortAddress(lead.address)
              )
            ) : null}
          </Fact>
          <Fact label="Teléfono" icon={<Phone />}>
            {tel ? <a href={tel}>{phoneLabel(lead)}</a> : null}
          </Fact>
          <Fact label="WhatsApp" icon={<WhatsApp />}>
            {wa ? (
              <a href={wa.href} target="_blank" rel="noreferrer">
                {lead.whatsapp ?? lead.phone_norm}
                {wa.probable ? " (probable)" : ""}
              </a>
            ) : null}
          </Fact>
          <Fact label="Mail" icon={<Mail />}>
            {lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : null}
          </Fact>
          <Fact label="Instagram" icon={<Instagram />}>
            {lead.instagram ? (
              <a href={lead.instagram} target="_blank" rel="noreferrer">
                {igHandle(lead.instagram)}
              </a>
            ) : null}
          </Fact>
          <Fact label="Facebook" icon={<Facebook />}>
            {lead.facebook ? (
              <a href={lead.facebook} target="_blank" rel="noreferrer">
                {shortUrl(lead.facebook)}
              </a>
            ) : null}
          </Fact>
          <Fact label="Web" icon={<Globe />}>
            {lead.website ? (
              <>
                <a href={lead.website} target="_blank" rel="noreferrer">
                  {shortUrl(lead.website)}
                </a>
                {lead.website_notes ? <span className="facts__note">{lead.website_notes}</span> : null}
              </>
            ) : null}
          </Fact>
          {lead.booking_url ? (
            <Fact label="Turnos" icon={<Globe />}>
              <a href={lead.booking_url} target="_blank" rel="noreferrer">
                {shortUrl(lead.booking_url)}
              </a>
            </Fact>
          ) : null}
          <Fact label="Google Maps" icon={<Pin />}>
            {lead.maps_url ? (
              <a href={lead.maps_url} target="_blank" rel="noreferrer">
                Ver ficha
              </a>
            ) : null}
          </Fact>
        </dl>
        <p className="provenance">
          Origen: {SOURCE_LABEL[lead.source ?? ""] ?? lead.source ?? "—"}
          {lead.search_query ? ` · "${lead.search_query}"` : ""} · cargado {relDate(lead.created_at)} · #{lead.id}
        </p>
      </Section>

      {/* Hook para la próxima etapa: propuestas (deals) y cobros (payments) del lead. */}
      <section className="soon" aria-label="Propuesta y pagos">
        <Wallet />
        <div>
          <b>Propuesta y pagos</b>
          <p>
            Próximamente: paquete, precio, landing de muestra y cobros de este comercio.
            {lead.deals_count || lead.payments_count
              ? ` Ya tiene ${lead.deals_count} propuesta(s) y ${lead.payments_count} pago(s) cargados.`
              : ""}
          </p>
        </div>
      </section>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="section">
      <h3 className="section__title">
        {title}
        {count ? <span className="count">{count}</span> : null}
      </h3>
      {children}
    </section>
  );
}

function Fact({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="facts__row">
      <dt>
        {icon}
        {label}
      </dt>
      <dd>{children ?? <span className="muted">—</span>}</dd>
    </div>
  );
}

function TouchForm({ lead, me, apply }: { lead: LeadDetail; me: Partner; apply: Apply }) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [by, setBy] = useState<Partner>(me);
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setBy(me), [me]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!channel) return;
    setBusy(true);
    const ok = await apply(
      api.touch(lead.id, { channel, by, summary: summary.trim() || undefined, outcome: outcome.trim() || undefined }),
      `Listo: ${lead.name} quedó contactado por ${CHANNEL_LABEL[channel]} (${by}).`,
    );
    setBusy(false);
    if (ok) {
      setChannel(null);
      setSummary("");
      setOutcome("");
    }
  };

  return (
    <form className="touch" onSubmit={submit} aria-label="Marcar como contactado">
      <h3 className="touch__title">
        <Check /> Marcar como contactado
      </h3>
      <div className="field">
        <span className="field__label" id="ch-label">
          Canal
        </span>
        <div className="seg seg--wrap" role="radiogroup" aria-labelledby="ch-label">
          {CHANNELS.map((c) => {
            const Icon = CHANNEL_ICON[c]!;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={channel === c}
                className={`seg__btn${channel === c ? " is-on" : ""}`}
                onClick={() => setChannel(c)}
                data-channel={c}
              >
                <Icon width={15} height={15} />
                {CHANNEL_LABEL[c]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="field">
        <span className="field__label" id="by-label">
          Quién
        </span>
        <div className="seg" role="radiogroup" aria-labelledby="by-label">
          {PARTNERS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={by === p}
              className={`seg__btn${by === p ? " is-on" : ""}`}
              onClick={() => setBy(p)}
              data-by={p}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="field__label">Qué le dijiste (opcional)</span>
        <input
          className="input"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Ej.: le mandé la landing de muestra"
          maxLength={1000}
          name="summary"
        />
      </label>
      <label className="field">
        <span className="field__label">Cómo salió (opcional)</span>
        <input
          className="input"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          placeholder="Ej.: sin respuesta / me pidió precios"
          maxLength={500}
          name="outcome"
        />
      </label>
      <button className="btn btn--primary btn--block" type="submit" disabled={!channel || busy}>
        {busy ? "Guardando…" : channel ? `Guardar contacto por ${CHANNEL_LABEL[channel]}` : "Elegí el canal"}
      </button>
      {lead.do_not_contact ? <p className="touch__warn">Ojo: este comercio pidió que no lo contactemos.</p> : null}
    </form>
  );
}

function StatusPicker({ lead, apply }: { lead: LeadDetail; apply: Apply }) {
  const [busy, setBusy] = useState<Status | null>(null);
  const pick = async (s: Status) => {
    if (s === lead.status) return;
    setBusy(s);
    await apply(api.status(lead.id, s), `Estado de ${lead.name}: ${STATUS_LABEL[s]}.`);
    setBusy(null);
  };
  return (
    <div className="status-pick" role="radiogroup" aria-label="Cambiar estado">
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={lead.status === s}
          className={`status-pick__btn s-${s}${lead.status === s ? " is-on" : ""}`}
          onClick={() => void pick(s)}
          disabled={busy != null}
          data-status={s}
        >
          <i aria-hidden />
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

function DncToggle({ lead, apply }: { lead: LeadDetail; apply: Apply }) {
  const on = Boolean(lead.do_not_contact);
  const toggle = async () => {
    const q = on
      ? `¿Sacar la marca de "no contactar" de ${lead.name}? Solo si fue un error.`
      : `¿Marcar a ${lead.name} como "no contactar"? Queda descartado y no se le escribe más.`;
    if (!window.confirm(q)) return;
    await apply(api.doNotContact(lead.id, !on), on ? "Se sacó la marca de no contactar." : `${lead.name}: no contactar.`);
  };
  return (
    <button type="button" className={`dnc-btn${on ? " is-on" : ""}`} onClick={() => void toggle()}>
      <Ban width={16} height={16} />
      {on ? "Sacar “no contactar”" : "Marcar “no contactar” (pidió la baja)"}
    </button>
  );
}

function NotesEditor({ lead, apply }: { lead: LeadDetail; apply: Apply }) {
  const [value, setValue] = useState(lead.notes ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(lead.notes ?? ""), [lead.notes]);
  const dirty = value.trim() !== (lead.notes ?? "").trim();
  return (
    <form
      className="notes"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await apply(api.notes(lead.id, value), "Notas guardadas.");
        setBusy(false);
      }}
    >
      <textarea
        className="input textarea"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Lo que haya que recordar de este comercio: quién atiende, horarios, qué le interesa…"
        aria-label="Notas"
        maxLength={10000}
      />
      <div className="notes__foot">
        <span className="sub">{dirty ? "Cambios sin guardar" : `Actualizado ${relDate(lead.updated_at)}`}</span>
        <button className="btn btn--ghost btn--sm" type="submit" disabled={!dirty || busy}>
          {busy ? "Guardando…" : "Guardar notas"}
        </button>
      </div>
    </form>
  );
}
