import "@radix-ui/themes/styles.css";
import "./booking.css";
import { Badge, Button, Callout, Flex, RadioCards, Spinner, Text, TextField, Theme } from "@radix-ui/themes";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ApiError,
  createBooking,
  formatARS,
  formatDuration,
  getAvailability,
  getServices,
  type Booking,
  type BusinessHour,
  type Service,
  type Slot,
} from "../api";
import { business, waLink } from "../content";

const TZ = "America/Argentina/Buenos_Aires";
const STEPS = ["Servicio", "Profesional", "Día y hora", "Tus datos"] as const;

const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD
const dayParts = (date: string) => {
  const d = new Date(`${date}T12:00:00-03:00`);
  return {
    wd: new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: TZ }).format(d).replace(".", ""),
    day: new Intl.DateTimeFormat("es-AR", { day: "numeric", timeZone: TZ }).format(d),
    month: new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: TZ }).format(d).replace(".", ""),
    long: new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(d),
    weekday: d.getUTCDay(),
  };
};

function nextDays(n: number) {
  const out: string[] = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) out.push(ymd(new Date(now + i * 86_400_000)));
  return out;
}

function gcalLink(b: Booking) {
  const fmt = (date: string, time: string) => {
    const d = new Date(`${date}T${time}:00-03:00`);
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${b.service.name} · Selkis Estudio`,
    dates: `${fmt(b.date, b.time)}/${fmt(b.date, b.endTime)}`,
    details: `Código de reserva ${b.code} (turno de demo)`,
    location: `${business.address}, ${business.area}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

interface Props {
  initialServiceId?: string;
  onDone: () => void;
}

export default function BookingFlow({ initialServiceId, onDone }: Props) {
  const [services, setServices] = useState<Service[] | null>(null);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [step, setStep] = useState(initialServiceId ? 1 : 0);
  const [serviceId, setServiceId] = useState<string | undefined>(initialServiceId);
  const [proId, setProId] = useState<string>("any");
  const days = useMemo(() => nextDays(21), []);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Booking | null>(null);

  useEffect(() => {
    getServices()
      .then((d) => {
        setServices(d.services);
        setHours(d.hours);
      })
      .catch(() => setError("No pudimos cargar los servicios. Probá de nuevo en un rato."));
  }, []);

  const service = services?.find((s) => s.id === serviceId);
  const openDays = new Set(hours.map((h) => h.weekday));

  // Primer día abierto por defecto al llegar al paso de fecha
  useEffect(() => {
    if (step === 2 && !date && hours.length) {
      setDate(days.find((d) => openDays.has(dayParts(d).weekday)) ?? null);
    }
  }, [step, hours]);

  useEffect(() => {
    if (step !== 2 || !date || !serviceId) return;
    let alive = true;
    setSlots(null);
    setTime(null);
    getAvailability(serviceId, date, proId === "any" ? undefined : proId)
      .then((r) => alive && setSlots(r.slots))
      .catch(() => alive && setSlots([]));
    return () => {
      alive = false;
    };
  }, [step, date, serviceId, proId]);

  const grouped = useMemo(() => {
    const m = new Map<string, Service[]>();
    for (const s of services ?? []) m.set(s.category, [...(m.get(s.category) ?? []), s]);
    return [...m.entries()];
  }, [services]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!serviceId || !date || !time) return;
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = "Ingresá tu nombre";
    if (!/^\+?[\d\s()-]{8,20}$/.test(form.phone.trim())) errs.phone = "Ingresá un teléfono válido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = "Ingresá un email válido";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    setError(null);
    try {
      const b = await createBooking({
        serviceId,
        professionalId: proId === "any" ? undefined : proId,
        date,
        time,
        ...form,
      });
      setDone(b);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Uy, ese horario se acaba de ocupar. Elegí otro, porfa.");
        setStep(2);
        setSlots(null);
        setTime(null);
        const r = await getAvailability(serviceId, date, proId === "any" ? undefined : proId).catch(() => null);
        setSlots(r?.slots ?? []);
      } else if (err instanceof ApiError && err.body.issues) {
        const issues = err.body.issues;
        setErrors(Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v[0] ?? "Revisá este dato"])));
      } else {
        setError("No pudimos confirmar el turno. Probá de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canNext =
    (step === 0 && !!serviceId) || step === 1 || (step === 2 && !!date && !!time) || step === 3;

  if (done) {
    const p = dayParts(done.date);
    return (
      <Theme accentColor="crimson" grayColor="mauve" radius="large" className="bk">
        <div className="bk-done">
          <div className="bk-check" aria-hidden>
            ✓
          </div>
          <h2 className="bk-title">¡Turno reservado!</h2>
          <p className="bk-sub">Te esperamos, {done.customer.name.split(" ")[0]}.</p>
          <dl className="bk-summary">
            <div>
              <dt>Servicio</dt>
              <dd>{done.service.name}</dd>
            </div>
            <div>
              <dt>Cuándo</dt>
              <dd>
                {p.long}, {done.time} hs
              </dd>
            </div>
            <div>
              <dt>Con</dt>
              <dd>{done.professional.name}</dd>
            </div>
            <div>
              <dt>Código</dt>
              <dd>
                <Badge size="2" color="crimson" variant="soft">
                  {done.code}
                </Badge>
              </dd>
            </div>
          </dl>
          <Callout.Root color="amber" size="1" variant="surface">
            <Callout.Text>Esto es una demo: el turno queda en el sistema de muestra, no en la agenda real del estudio.</Callout.Text>
          </Callout.Root>
          <Flex direction="column" gap="2" mt="4">
            <Button size="3" asChild>
              <a href={gcalLink(done)} target="_blank" rel="noopener">
                Agregar a mi calendario
              </a>
            </Button>
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
        <p className="bk-kicker">
          Paso {step + 1} de {STEPS.length} · {STEPS[step]}
        </p>
        <div className="bk-progress" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? "on" : ""} />
          ))}
        </div>
      </div>

      <div className="bk-body" key={step}>
        {error && (
          <Callout.Root color="red" size="1" mb="3">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        {step === 0 && (
          <>
            <h2 className="bk-title">¿Qué te hacés?</h2>
            {!services ? (
              <div className="bk-center">
                <Spinner size="3" />
              </div>
            ) : (
              grouped.map(([cat, list]) => (
                <div key={cat} className="bk-group">
                  <Text as="p" size="1" weight="bold" color="gray" className="bk-group-t">
                    {cat}
                  </Text>
                  <RadioCards.Root
                    value={serviceId ?? ""}
                    onValueChange={(v) => {
                      setServiceId(v);
                      setProId("any");
                      setDate(null);
                    }}
                    columns="1"
                    gap="2"
                  >
                    {list.map((s) => (
                      <RadioCards.Item key={s.id} value={s.id} className="bk-card">
                        <div className="bk-card-row">
                          <div>
                            <Text as="div" weight="bold" size="2">
                              {s.name}
                            </Text>
                            <Text as="div" size="1" color="gray">
                              {formatDuration(s.durationMin)}
                            </Text>
                          </div>
                          <Text size="2" className="bk-price">
                            <small>desde</small> {formatARS(s.priceFrom)}
                          </Text>
                        </div>
                      </RadioCards.Item>
                    ))}
                  </RadioCards.Root>
                </div>
              ))
            )}
            <Text as="p" size="1" color="gray" mt="3">
              Precios orientativos de muestra.
            </Text>
          </>
        )}

        {step === 1 && service && (
          <>
            <h2 className="bk-title">¿Con quién?</h2>
            <p className="bk-sub">{service.name} · opcional</p>
            <RadioCards.Root value={proId} onValueChange={setProId} columns="1" gap="2">
              <RadioCards.Item value="any" className="bk-card">
                <div className="bk-card-row">
                  <div>
                    <Text as="div" weight="bold" size="2">
                      Sin preferencia
                    </Text>
                    <Text as="div" size="1" color="gray">
                      Te mostramos más horarios
                    </Text>
                  </div>
                  <Badge color="crimson" variant="soft">
                    Recomendado
                  </Badge>
                </div>
              </RadioCards.Item>
              {service.professionals.map((p) => (
                <RadioCards.Item key={p.id} value={p.id} className="bk-card">
                  <div className="bk-card-row">
                    <div className="bk-pro">
                      <span className="bk-avatar" aria-hidden>
                        {p.name.slice(-1)}
                      </span>
                      <div>
                        <Text as="div" weight="bold" size="2">
                          {p.name}
                        </Text>
                        <Text as="div" size="1" color="gray">
                          {p.specialty}
                        </Text>
                      </div>
                    </div>
                  </div>
                </RadioCards.Item>
              ))}
            </RadioCards.Root>
            <Text as="p" size="1" color="gray" mt="3">
              Nombres de muestra: el estudio carga su equipo real.
            </Text>
          </>
        )}

        {step === 2 && service && (
          <>
            <h2 className="bk-title">Elegí día y horario</h2>
            <p className="bk-sub">
              {service.name} · {formatDuration(service.durationMin)}
            </p>
            <div className="bk-days" role="listbox" aria-label="Días">
              {days.map((d) => {
                const p = dayParts(d);
                const closed = !openDays.has(p.weekday);
                return (
                  <button
                    key={d}
                    type="button"
                    role="option"
                    aria-selected={date === d}
                    disabled={closed}
                    className={`bk-day ${date === d ? "is-on" : ""}`}
                    onClick={() => setDate(d)}
                  >
                    <span className="wd">{p.wd}</span>
                    <span className="dn">{p.day}</span>
                    <span className="mo">{closed ? "cerrado" : p.month}</span>
                  </button>
                );
              })}
            </div>
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
                    className={`bk-slot ${time === s.time ? "is-on" : ""}`}
                    aria-pressed={time === s.time}
                    onClick={() => setTime(s.time)}
                  >
                    {s.time}
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {step === 3 && service && date && time && (
          <form id="bk-form" onSubmit={submit} noValidate>
            <h2 className="bk-title">Tus datos</h2>
            <div className="bk-recap">
              <strong>{service.name}</strong>
              <span>
                {dayParts(date).long} · {time} hs
              </span>
            </div>
            <label className="bk-field">
              <span>Nombre y apellido</span>
              <TextField.Root
                size="3"
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-invalid={!!errors.name}
              />
              {errors.name && <em>{errors.name}</em>}
            </label>
            <label className="bk-field">
              <span>Celular (WhatsApp)</span>
              <TextField.Root
                size="3"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="11 1234-5678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                aria-invalid={!!errors.phone}
              />
              {errors.phone && <em>{errors.phone}</em>}
            </label>
            <label className="bk-field">
              <span>Email</span>
              <TextField.Root
                size="3"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                aria-invalid={!!errors.email}
              />
              {errors.email && <em>{errors.email}</em>}
            </label>
            <Text as="p" size="1" color="gray">
              Usamos tus datos solo para confirmarte el turno.
            </Text>
          </form>
        )}
      </div>

      <div className="bk-foot">
        {step > 0 ? (
          <Button size="3" variant="soft" color="gray" onClick={() => setStep(step - 1)}>
            Atrás
          </Button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <Button size="3" disabled={!canNext} onClick={() => setStep(step + 1)} className="bk-next">
            Continuar
          </Button>
        ) : (
          <Button size="3" type="submit" form="bk-form" loading={submitting} className="bk-next">
            Confirmar turno
          </Button>
        )}
      </div>
      <p className="bk-help">
        ¿Dudas? <a href={waLink()} target="_blank" rel="noopener">Escribinos por WhatsApp</a>
      </p>
    </Theme>
  );
}
