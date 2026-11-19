// "Gestionar mi turno": la clienta se identifica con el código de reserva + el celular o el email
// con el que reservó, ve su turno y lo cambia (servicio, profesional, día, horario) o lo cancela.
import "@radix-ui/themes/styles.css";
import "./booking.css";
import { Button, Callout, Flex, Spinner, Text, TextField, Theme } from "@radix-ui/themes";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ApiError,
  api,
  errorMessage,
  fieldErrors,
  formatARS,
  formatDuration,
  getServices,
  type BusinessHour,
  type MyBooking,
  type Service,
  type Slot,
} from "../api";
import { waLink } from "../content";
import { dayParts, gcalLink, nextDays } from "./dates";
import { BookingSummary, DayPicker, SlotGrid } from "./pickers";

type View = "identify" | "view" | "edit" | "confirm-cancel" | "changed" | "cancelled";

interface Props {
  /** Si viene de la confirmación de una reserva, entra directo con estos datos. */
  prefill?: { code: string; contact: string };
  onDone: () => void;
  onBook: () => void;
}

export default function ManageFlow({ prefill, onDone, onBook }: Props) {
  const [view, setView] = useState<View>("identify");
  const [auth, setAuth] = useState(prefill ?? { code: "", contact: "" });
  const [authErrors, setAuthErrors] = useState<Record<string, string>>({});
  const [booking, setBooking] = useState<MyBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [services, setServices] = useState<Service[] | null>(null);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [proId, setProId] = useState("any");
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [time, setTime] = useState<string | null>(null);

  async function lookup(a = auth) {
    setBusy(true);
    setError(null);
    setAuthErrors({});
    try {
      const b = await api.findMyBooking(a);
      setBooking(b);
      setView("view");
    } catch (e) {
      if (e instanceof ApiError && e.body.issues) setAuthErrors(fieldErrors(e));
      else setError(errorMessage(e, "No pudimos buscar tu turno. Probá de nuevo."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (prefill) void lookup(prefill);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit() {
    if (!booking) return;
    setError(null);
    setServiceId(booking.service.id);
    setProId(booking.professional.id);
    setDate(booking.date);
    setTime(null);
    setView("edit");
    if (!services) {
      getServices()
        .then((d) => {
          setServices(d.services);
          setHours(d.hours);
        })
        .catch(() => setError("No pudimos cargar los servicios. Probá de nuevo en un rato."));
    }
  }

  const service = services?.find((s) => s.id === serviceId);
  const openDays = useMemo(() => new Set(hours.map((h) => h.weekday)), [hours]);
  // 30 días desde hoy, estirando hasta la fecha actual del turno si es más lejana.
  const days = useMemo(() => {
    if (!booking) return nextDays(30);
    const until = Math.ceil((new Date(`${booking.date}T12:00:00-03:00`).getTime() - Date.now()) / 86_400_000) + 1;
    return nextDays(Math.min(60, Math.max(30, until)));
  }, [booking]);

  useEffect(() => {
    if (view !== "edit" || !date || !serviceId || !booking) return;
    let alive = true;
    setSlots(null);
    setTime(null);
    api
      .myAvailability({ ...auth, serviceId, date, professionalId: proId === "any" ? undefined : proId })
      .then((r) => alive && setSlots(r.slots))
      .catch(() => alive && setSlots([]));
    return () => {
      alive = false;
    };
  }, [view, date, serviceId, proId]); // eslint-disable-line react-hooks/exhaustive-deps

  const unchanged =
    !!booking &&
    serviceId === booking.service.id &&
    date === booking.date &&
    time === booking.time &&
    (proId === "any" || proId === booking.professional.id);

  async function saveChange() {
    if (!booking || !date || !time || !serviceId) return;
    setBusy(true);
    setError(null);
    try {
      const b = await api.changeMyBooking({
        ...auth,
        serviceId,
        date,
        time,
        professionalId: proId === "any" ? undefined : proId,
      });
      setBooking(b);
      setView("changed");
    } catch (e) {
      setError(errorMessage(e, "No pudimos cambiar el turno. Probá de nuevo."));
      if (e instanceof ApiError && e.status === 409 && e.body.error === "slot_unavailable") {
        setSlots(null);
        setTime(null);
        const r = await api
          .myAvailability({ ...auth, serviceId, date, professionalId: proId === "any" ? undefined : proId })
          .catch(() => null);
        setSlots(r?.slots ?? []);
      } else if (e instanceof ApiError && e.status === 409) {
        // Cancelado o ya sin tiempo: volvemos a mostrar el turno como está.
        const b = await api.findMyBooking(auth).catch(() => null);
        if (b) setBooking(b);
        setView("view");
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      setBooking(await api.cancelMyBooking(auth));
      setView("cancelled");
    } catch (e) {
      setError(errorMessage(e, "No pudimos cancelar el turno. Probá de nuevo."));
      setView("view");
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const m = new Map<string, Service[]>();
    for (const s of services ?? []) m.set(s.category, [...(m.get(s.category) ?? []), s]);
    return [...m.entries()];
  }, [services]);

  const errorBox = error && (
    <Callout.Root color="red" size="1" mb="3" role="alert">
      <Callout.Text>{error}</Callout.Text>
    </Callout.Root>
  );

  // ---- Paso final: cambio o cancelación hechos ----
  if ((view === "changed" || view === "cancelled") && booking) {
    const changed = view === "changed";
    return (
      <Theme accentColor="crimson" grayColor="mauve" radius="large" className="bk">
        <div className="bk-done">
          <div className="bk-check" aria-hidden>
            {changed ? "✓" : "✕"}
          </div>
          <h2 className="bk-title">{changed ? "¡Listo, turno cambiado!" : "Turno cancelado"}</h2>
          <p className="bk-sub">
            {changed ? "Te esperamos en el nuevo horario." : "El horario quedó libre. ¡Gracias por avisar!"}
          </p>
          <BookingSummary booking={booking} />
          <Flex direction="column" gap="2" mt="4">
            {changed ? (
              <Button size="3" asChild>
                <a href={gcalLink(booking)} target="_blank" rel="noopener">
                  Agregar a mi calendario
                </a>
              </Button>
            ) : (
              <Button size="3" onClick={onBook}>
                Reservar otro turno
              </Button>
            )}
            <Button size="3" variant="soft" color="gray" onClick={onDone}>
              Volver al sitio
            </Button>
          </Flex>
        </div>
      </Theme>
    );
  }

  return (
    <Theme accentColor="crimson" grayColor="mauve" radius="large" className="bk">
      <div className="bk-head">
        <p className="bk-kicker">Gestionar mi turno</p>
      </div>

      <div className="bk-body" key={view}>
        {errorBox}

        {view === "identify" && (
          <form id="mt-form" noValidate onSubmit={(e: FormEvent) => (e.preventDefault(), void lookup())}>
            <h2 className="bk-title">Buscá tu turno</h2>
            <p className="bk-sub">Con el código de reserva y el celular o email que usaste al reservar.</p>
            <label className="bk-field">
              <span>Código de reserva</span>
              <TextField.Root
                size="3"
                placeholder="SLK-A1B2C3"
                autoCapitalize="characters"
                autoComplete="off"
                value={auth.code}
                onChange={(e) => setAuth({ ...auth, code: e.target.value })}
                aria-invalid={!!authErrors.code}
              />
              {authErrors.code && <em>{authErrors.code}</em>}
            </label>
            <label className="bk-field">
              <span>Celular o email</span>
              <TextField.Root
                size="3"
                autoComplete="email"
                placeholder="11 1234-5678 o vos@mail.com"
                value={auth.contact}
                onChange={(e) => setAuth({ ...auth, contact: e.target.value })}
                aria-invalid={!!authErrors.contact}
              />
              {authErrors.contact && <em>{authErrors.contact}</em>}
            </label>
            <Text as="p" size="1" color="gray">
              El código está en la confirmación de tu reserva (empieza con SLK-).
            </Text>
          </form>
        )}

        {view === "view" && booking && (
          <>
            <h2 className="bk-title">Tu turno</h2>
            <p className="bk-sub">Hola, {booking.customer.name.split(" ")[0]}.</p>
            <BookingSummary booking={booking} />
            {booking.status === "cancelled" ? (
              <Callout.Root color="gray" size="1">
                <Callout.Text>Este turno está cancelado. Si querés, reservá uno nuevo.</Callout.Text>
              </Callout.Root>
            ) : !booking.canChange ? (
              <Callout.Root color="amber" size="1">
                <Callout.Text>
                  Falta menos de una hora para el turno: para cambiarlo o cancelarlo{" "}
                  <a href={waLink(`Hola! Necesito cambiar mi turno ${booking.code}`)} target="_blank" rel="noopener">
                    escribinos por WhatsApp
                  </a>
                  .
                </Callout.Text>
              </Callout.Root>
            ) : (
              <Text as="p" size="1" color="gray">
                Podés cambiarlo o cancelarlo online hasta una hora antes.
              </Text>
            )}
            <div className="bk-actions">
              {booking.status === "confirmed" && booking.canChange && (
                <>
                  <Button size="3" onClick={startEdit}>
                    Cambiar día, horario o servicio
                  </Button>
                  <Button size="3" variant="soft" color="red" onClick={() => setView("confirm-cancel")}>
                    Cancelar turno
                  </Button>
                </>
              )}
              {booking.status === "cancelled" && (
                <Button size="3" onClick={onBook}>
                  Reservar un turno nuevo
                </Button>
              )}
            </div>
          </>
        )}

        {view === "confirm-cancel" && booking && (
          <>
            <h2 className="bk-title">¿Cancelamos el turno?</h2>
            <p className="bk-sub">El horario queda libre para otra persona. No se puede deshacer.</p>
            <BookingSummary booking={booking} />
          </>
        )}

        {view === "edit" && booking && (
          <>
            <h2 className="bk-title">Cambiar turno</h2>
            <p className="bk-sub">
              Ahora: {booking.service.name} · {dayParts(booking.date).long}, {booking.time} hs
            </p>
            {!services ? (
              <div className="bk-center">
                <Spinner size="3" />
              </div>
            ) : (
              <>
                <label className="bk-field">
                  <span>Servicio</span>
                  <select
                    className="bk-native-select"
                    value={serviceId}
                    onChange={(e) => {
                      const next = services.find((s) => s.id === e.target.value);
                      setServiceId(e.target.value);
                      if (!next?.professionals.some((p) => p.id === proId)) setProId("any");
                    }}
                  >
                    {!service && <option value={serviceId}>{booking.service.name} (ya no disponible)</option>}
                    {grouped.map(([cat, list]) => (
                      <optgroup key={cat} label={cat}>
                        {list.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {formatDuration(s.durationMin)} · desde {formatARS(s.priceFrom)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="bk-field">
                  <span>Profesional</span>
                  <select className="bk-native-select" value={proId} onChange={(e) => setProId(e.target.value)}>
                    <option value="any">Sin preferencia (más horarios)</option>
                    {service?.professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.specialty}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="bk-step-t">Día</p>
                <DayPicker days={days} openDays={openDays} value={date} onChange={setDate} />
                <p className="bk-step-t">Horario</p>
                {service ? (
                  <SlotGrid
                    slots={slots}
                    value={time}
                    onChange={setTime}
                    current={date === booking.date && serviceId === booking.service.id ? booking.time : undefined}
                  />
                ) : (
                  <p className="bk-empty">Elegí un servicio para ver los horarios.</p>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="bk-foot">
        {view === "identify" && (
          <>
            <span />
            <Button size="3" type="submit" form="mt-form" loading={busy} className="bk-next">
              Buscar mi turno
            </Button>
          </>
        )}
        {view === "view" && (
          <>
            <Button size="3" variant="soft" color="gray" onClick={() => setView("identify")}>
              Otro turno
            </Button>
            <Button size="3" variant="soft" color="gray" onClick={onDone} className="bk-next">
              Listo
            </Button>
          </>
        )}
        {view === "confirm-cancel" && (
          <>
            <Button size="3" variant="soft" color="gray" onClick={() => setView("view")}>
              Volver
            </Button>
            <Button size="3" color="red" loading={busy} onClick={() => void cancel()} className="bk-next">
              Sí, cancelar turno
            </Button>
          </>
        )}
        {view === "edit" && (
          <>
            <Button size="3" variant="soft" color="gray" onClick={() => setView("view")}>
              Atrás
            </Button>
            <Button
              size="3"
              disabled={!time || unchanged || !service}
              loading={busy}
              onClick={() => void saveChange()}
              className="bk-next"
            >
              Confirmar cambio
            </Button>
          </>
        )}
      </div>
      <p className="bk-help">
        ¿Dudas? <a href={waLink()} target="_blank" rel="noopener">Escribinos por WhatsApp</a>
      </p>
    </Theme>
  );
}
