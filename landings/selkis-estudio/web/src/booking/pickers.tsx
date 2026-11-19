// Piezas del flujo de reserva que comparte "Gestionar mi turno".
import { Badge, Spinner, Text } from "@radix-ui/themes";
import type { Booking, Slot } from "../api";
import { dayParts } from "./dates";

export function DayPicker({
  days,
  openDays,
  value,
  onChange,
}: {
  days: string[];
  openDays: Set<number>;
  value: string | null;
  onChange: (d: string) => void;
}) {
  return (
    <div className="bk-days" role="listbox" aria-label="Días">
      {days.map((d) => {
        const p = dayParts(d);
        const closed = !openDays.has(p.weekday);
        return (
          <button
            key={d}
            type="button"
            role="option"
            aria-selected={value === d}
            aria-label={`${p.long}${closed ? " (cerrado)" : ""}`}
            disabled={closed}
            className={`bk-day ${value === d ? "is-on" : ""}`}
            onClick={() => onChange(d)}
          >
            <span className="wd">{p.wd}</span>
            <span className="dn">{p.day}</span>
            <span className="mo">{closed ? "cerrado" : p.month}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SlotGrid({
  slots,
  value,
  onChange,
  current,
}: {
  slots: Slot[] | null;
  value: string | null;
  onChange: (t: string) => void;
  /** Horario actual del turno (en "Gestionar mi turno"). */
  current?: string;
}) {
  return (
    <div className="bk-slots" aria-live="polite">
      {slots === null ? (
        <div className="bk-center">
          <Spinner size="3" />
        </div>
      ) : slots.length === 0 ? (
        <p className="bk-empty">No quedan horarios este día. Probá con otro 💅</p>
      ) : (
        slots.map((s) => (
          <button
            key={s.time}
            type="button"
            className={`bk-slot ${value === s.time ? "is-on" : ""} ${current === s.time ? "is-current" : ""}`}
            aria-pressed={value === s.time}
            aria-label={current === s.time ? `${s.time} (tu horario actual)` : undefined}
            onClick={() => onChange(s.time)}
          >
            {s.time}
            {current === s.time && <small>actual</small>}
          </button>
        ))
      )}
    </div>
  );
}

/** Resumen de un turno (confirmación y "Gestionar mi turno"). */
export function BookingSummary({ booking }: { booking: Booking }) {
  const p = dayParts(booking.date);
  return (
    <dl className="bk-summary">
      <div>
        <dt>Servicio</dt>
        <dd>{booking.service.name}</dd>
      </div>
      <div>
        <dt>Cuándo</dt>
        <dd>
          {p.long}, {booking.time} hs
        </dd>
      </div>
      <div>
        <dt>Con</dt>
        <dd>{booking.professional.name}</dd>
      </div>
      <div>
        <dt>Código</dt>
        <dd>
          <Badge size="2" color="crimson" variant="soft">
            {booking.code}
          </Badge>
        </dd>
      </div>
      {booking.status === "cancelled" && (
        <div>
          <dt>Estado</dt>
          <dd>
            <Text color="red">Cancelado</Text>
          </dd>
        </div>
      )}
    </dl>
  );
}
