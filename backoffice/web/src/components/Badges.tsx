import { CHANNEL_LABEL, STATUS_LABEL, WEBSITE_KIND_LABEL, type Status, type WebsiteKind } from "../../../server/src/domain";
import { CHANNEL_ICON, Ban, Star } from "./Icons";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge badge--status s-${status}`}>
      <i aria-hidden />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function WebBadge({ kind }: { kind: WebsiteKind }) {
  return <span className={`badge badge--web w-${kind}`}>{WEBSITE_KIND_LABEL[kind] ?? kind}</span>;
}

export function DncBadge() {
  return (
    <span className="badge badge--dnc" title="Pidió que no lo contactemos">
      <Ban width={13} height={13} />
      No contactar
    </span>
  );
}

export function Rating({ rating, reviews }: { rating: number | null; reviews: number | null }) {
  if (rating == null) return <span className="muted">—</span>;
  return (
    <span className="rating" title={`${rating} de 5 · ${reviews ?? 0} reseñas en Google`}>
      <Star width={14} height={14} />
      <b>{rating.toFixed(1)}</b>
      <span>({reviews ?? 0})</span>
    </span>
  );
}

export function ChannelChip({ channel, by }: { channel: string; by?: string | null }) {
  const Icon = CHANNEL_ICON[channel];
  return (
    <span className={`chan chan--${channel}`}>
      {Icon ? <Icon width={14} height={14} /> : null}
      {CHANNEL_LABEL[channel] ?? channel}
      {by ? <span className="chan__by">· {by}</span> : null}
    </span>
  );
}
