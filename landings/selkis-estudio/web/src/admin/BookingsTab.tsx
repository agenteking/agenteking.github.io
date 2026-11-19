import { Badge, Button, Callout, Card, Dialog, Flex, Select, Spinner, Table, Text, TextArea, TextField } from "@radix-ui/themes";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  api,
  errorMessage,
  fieldErrors,
  type AdminBookingQuery,
  type Booking,
  type BookingEvent,
  type Conflict,
  type Slot,
} from "../api";
import { shortDate, todayBA, useAdmin } from "./context";
import { ConfirmButton, Field, Notice, useNotice } from "./ui";

const ACTIONS: Record<BookingEvent["action"], string> = {
  created: "Creado",
  updated: "Datos editados",
  rescheduled: "Cambiado",
  cancelled: "Cancelado",
  reactivated: "Reactivado",
};

function BookingDialog({ booking, onClose, onSaved }: { booking: Booking | "new"; onClose: () => void; onSaved: () => void }) {
  const { adminKey, catalog, flash, onError } = useAdmin();
  const isNew = booking === "new";
  const firstService = catalog.services.find((s) => s.active && s.professionalIds.length > 0);
  const [form, setForm] = useState(() =>
    isNew
      ? {
          serviceId: firstService?.id ?? "",
          professionalId: firstService?.professionalIds[0] ?? "",
          date: todayBA(),
          time: "",
          name: "",
          phone: "",
          email: "",
          notes: "",
          status: "confirmed" as Booking["status"],
        }
      : {
          serviceId: booking.service.id,
          professionalId: booking.professional.id,
          date: booking.date,
          time: booking.time,
          name: booking.customer.name,
          phone: booking.customer.phone,
          email: booking.customer.email,
          notes: booking.notes,
          status: booking.status,
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<BookingEvent[] | null>(null);
  const [free, setFree] = useState<Slot[] | null>(null);

  useEffect(() => {
    if (isNew) return;
    api
      .adminGetBooking(adminKey, booking.id)
      .then((b) => setEvents(b.events))
      .catch(() => setEvents([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Horarios libres según las reglas del sitio (sugerencias para elegir rápido).
  useEffect(() => {
    if (!form.serviceId || !form.professionalId || !/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      setFree(null);
      return;
    }
    let alive = true;
    setFree(null);
    api
      .getAvailability(form.serviceId, form.date, form.professionalId)
      .then((r) => alive && setFree(r.slots))
      .catch(() => alive && setFree([]));
    return () => {
      alive = false;
    };
  }, [form.serviceId, form.professionalId, form.date]);

  const service = catalog.services.find((s) => s.id === form.serviceId);

  async function save(force: boolean) {
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      const body = { ...form, force };
      const b = isNew ? await api.adminCreateBooking(adminKey, body) : await api.adminUpdateBooking(adminKey, booking.id, body);
      flash(isNew ? `Turno ${b.code} creado para ${b.customer.name}.` : `Turno ${b.code} guardado.`);
      onSaved();
      onClose();
    } catch (err) {
      onError(err);
      if (err instanceof ApiError && err.body.error === "conflicts" && err.body.conflicts) setConflicts(err.body.conflicts);
      else if (err instanceof ApiError && err.body.issues) setErrors(fieldErrors(err));
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setConflicts(null);
    void save(false);
  };
  const set = (patch: Partial<typeof form>) => {
    setConflicts(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Content maxWidth="640px">
        <Dialog.Title>{isNew ? "Nuevo turno" : `Turno ${booking.code}`}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          {isNew
            ? "Para turnos por teléfono o en el local. No aplica la anticipación mínima; si choca con la agenda te avisamos."
            : `Reservado ${booking.source === "admin" ? "desde el panel" : "online"} el ${shortDate(booking.createdAt.slice(0, 10))}.`}
        </Dialog.Description>
        <form onSubmit={submit} noValidate>
          <Flex direction="column" gap="3">
            <div className="adm-grid2">
              <Field label="Servicio" error={errors.serviceId}>
                {(p) => (
                  <Select.Root
                    value={form.serviceId}
                    onValueChange={(v) => {
                      const s = catalog.services.find((x) => x.id === v);
                      set({
                        serviceId: v,
                        professionalId: s && !s.professionalIds.includes(form.professionalId) ? (s.professionalIds[0] ?? form.professionalId) : form.professionalId,
                      });
                    }}
                  >
                    <Select.Trigger {...p} placeholder="Elegí un servicio" />
                    <Select.Content position="popper">
                      {catalog.services.map((s) => (
                        <Select.Item key={s.id} value={s.id}>
                          {s.name}
                          {s.active ? "" : " (inactivo)"}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                )}
              </Field>
              <Field label="Profesional" error={errors.professionalId}>
                {(p) => (
                  <Select.Root value={form.professionalId} onValueChange={(v) => set({ professionalId: v })}>
                    <Select.Trigger {...p} placeholder="Elegí una profesional" />
                    <Select.Content position="popper">
                      {catalog.professionals.map((pr) => (
                        <Select.Item key={pr.id} value={pr.id}>
                          {pr.name}
                          {!pr.active ? " (inactiva)" : service && !service.professionalIds.includes(pr.id) ? " (no hace este servicio)" : ""}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                )}
              </Field>
              <Field label="Día" error={errors.date}>
                {(p) => <TextField.Root {...p} type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />}
              </Field>
              <Field label="Hora" error={errors.time} hint={service ? `Dura ${service.durationMin} min.` : undefined}>
                {(p) => <TextField.Root {...p} type="time" step={900} value={form.time} onChange={(e) => set({ time: e.target.value })} />}
              </Field>
            </div>
            <div>
              <Text size="1" color="gray" as="p" mb="1">
                Libres ese día (según la agenda online):
              </Text>
              <div className="adm-slots">
                {free === null ? (
                  <Spinner size="1" />
                ) : free.length === 0 ? (
                  <Text size="1" color="gray">
                    Ninguno (cerrado, lleno o con menos de una hora de anticipación). Podés cargar la hora a mano.
                  </Text>
                ) : (
                  free.map((s) => (
                    <Button
                      key={s.time}
                      type="button"
                      size="1"
                      variant={form.time === s.time ? "solid" : "surface"}
                      onClick={() => set({ time: s.time })}
                    >
                      {s.time}
                    </Button>
                  ))
                )}
              </div>
            </div>
            <div className="adm-grid2">
              <Field label="Nombre de la clienta" error={errors.name}>
                {(p) => <TextField.Root {...p} autoComplete="off" value={form.name} onChange={(e) => set({ name: e.target.value })} />}
              </Field>
              <Field label="Celular" error={errors.phone} hint="Opcional en el panel.">
                {(p) => <TextField.Root {...p} type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />}
              </Field>
              <Field label="Email" error={errors.email} hint="Opcional en el panel.">
                {(p) => <TextField.Root {...p} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />}
              </Field>
              {!isNew && (
                <Field label="Estado" error={errors.status}>
                  {(p) => (
                    <Select.Root value={form.status} onValueChange={(v) => set({ status: v as Booking["status"] })}>
                      <Select.Trigger {...p} />
                      <Select.Content position="popper">
                        <Select.Item value="confirmed">Confirmado</Select.Item>
                        <Select.Item value="cancelled">Cancelado</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  )}
                </Field>
              )}
            </div>
            <Field label="Notas internas" error={errors.notes}>
              {(p) => <TextArea {...p} rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />}
            </Field>

            {conflicts && (
              <Callout.Root color="amber" size="1" role="alert">
                <Callout.Text>
                  <strong>Ojo, el turno choca con la agenda:</strong>
                </Callout.Text>
                <ul className="adm-conflicts">
                  {conflicts.map((c, i) => (
                    <li key={i}>{c.message}</li>
                  ))}
                </ul>
                <Flex gap="2" mt="1">
                  <Button type="button" size="1" color="amber" loading={saving} onClick={() => void save(true)}>
                    Guardar igual
                  </Button>
                  <Button type="button" size="1" variant="soft" color="gray" onClick={() => setConflicts(null)}>
                    Lo cambio
                  </Button>
                </Flex>
              </Callout.Root>
            )}
            {error && (
              <Text color="red" size="2" role="alert">
                {error}
              </Text>
            )}

            {!isNew && (
              <details className="adm-history">
                <summary>Historial</summary>
                {events === null ? (
                  <Spinner size="1" />
                ) : events.length === 0 ? (
                  <Text size="1" color="gray">
                    Sin movimientos registrados.
                  </Text>
                ) : (
                  <ol>
                    {events.map((e) => (
                      <li key={e.id}>
                        <Text size="1" color="gray">
                          {new Date(e.createdAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} ·{" "}
                          {e.actor === "admin" ? "panel" : "clienta"}
                        </Text>
                        <br />
                        <Text size="2">
                          <strong>{ACTIONS[e.action] ?? e.action}</strong> {e.detail}
                        </Text>
                      </li>
                    ))}
                  </ol>
                )}
              </details>
            )}

            <Flex gap="3" justify="end" mt="2">
              <Dialog.Close>
                <Button type="button" variant="soft" color="gray">
                  Cerrar
                </Button>
              </Dialog.Close>
              <Button type="submit" loading={saving && !conflicts}>
                {isNew ? "Crear turno" : "Guardar cambios"}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default function BookingsTab() {
  const { adminKey, catalog, flash, onError } = useAdmin();
  const [filters, setFilters] = useState<{ from: string; to: string; status: NonNullable<AdminBookingQuery["status"]>; professionalId: string }>(
    () => ({ from: todayBA(), to: "", status: "confirmed", professionalId: "all" }),
  );
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [editing, setEditing] = useState<Booking | "new" | null>(null);
  const [notice, setNotice] = useNotice();

  const load = useCallback(async () => {
    try {
      const r = await api.adminListBookings(adminKey, {
        from: filters.from || undefined,
        to: filters.to || undefined,
        status: filters.status,
        professionalId: filters.professionalId === "all" ? undefined : filters.professionalId,
      });
      setBookings(r.bookings);
    } catch (e) {
      onError(e);
      setNotice({ message: errorMessage(e, "No se pudo cargar la agenda.") });
    }
  }, [adminKey, filters, onError, setNotice]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      flash(ok);
      setNotice(null);
      await load();
    } catch (e) {
      onError(e);
      setNotice({ message: errorMessage(e) });
    }
  }

  return (
    <>
      <div className="adm-toolbar" role="group" aria-label="Filtros de turnos">
        <Field label="Desde">
          {(p) => <TextField.Root {...p} type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />}
        </Field>
        <Field label="Hasta">
          {(p) => <TextField.Root {...p} type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />}
        </Field>
        <Field label="Estado">
          {(p) => (
            <Select.Root value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v as typeof filters.status })}>
              <Select.Trigger {...p} />
              <Select.Content position="popper">
                <Select.Item value="confirmed">Confirmados</Select.Item>
                <Select.Item value="cancelled">Cancelados</Select.Item>
                <Select.Item value="all">Todos</Select.Item>
              </Select.Content>
            </Select.Root>
          )}
        </Field>
        <Field label="Profesional">
          {(p) => (
            <Select.Root value={filters.professionalId} onValueChange={(v) => setFilters({ ...filters, professionalId: v })}>
              <Select.Trigger {...p} />
              <Select.Content position="popper">
                <Select.Item value="all">Todas</Select.Item>
                {catalog.professionals.map((pr) => (
                  <Select.Item key={pr.id} value={pr.id}>
                    {pr.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          )}
        </Field>
        <Flex gap="2" align="end" className="adm-toolbar-actions">
          <Button variant="soft" onClick={() => void load()}>
            Actualizar
          </Button>
          <Button onClick={() => setEditing("new")}>Nuevo turno</Button>
        </Flex>
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <Card className="adm-card">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Cuándo</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Servicio</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Clienta</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Profesional</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Estado</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <span className="sr-only">Acciones</span>
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {bookings === null && (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <Spinner />
                </Table.Cell>
              </Table.Row>
            )}
            {bookings?.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <Text color="gray">No hay turnos con estos filtros.</Text>
                </Table.Cell>
              </Table.Row>
            )}
            {bookings?.map((b) => (
              <Table.Row key={b.id}>
                <Table.RowHeaderCell className="adm-nowrap">
                  <Text weight="bold">{shortDate(b.date)}</Text>
                  <br />
                  <Text color="gray" size="1">
                    {b.time}–{b.endTime} · {b.code}
                  </Text>
                </Table.RowHeaderCell>
                <Table.Cell>{b.service.name}</Table.Cell>
                <Table.Cell>
                  {b.customer.name}
                  <br />
                  <Text color="gray" size="1">
                    {[b.customer.phone, b.customer.email].filter(Boolean).join(" · ") || "sin contacto"}
                  </Text>
                </Table.Cell>
                <Table.Cell>{b.professional.name}</Table.Cell>
                <Table.Cell>
                  <Flex direction="column" gap="1" align="start">
                    <Badge color={b.status === "confirmed" ? "green" : "gray"}>{b.status === "confirmed" ? "Confirmado" : "Cancelado"}</Badge>
                    {b.source === "admin" && (
                      <Badge color="blue" variant="soft" size="1">
                        panel
                      </Badge>
                    )}
                  </Flex>
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2" wrap="wrap">
                    <Button size="1" variant="soft" onClick={() => setEditing(b)} aria-label={`Editar turno ${b.code}`}>
                      Editar
                    </Button>
                    {b.status === "confirmed" && (
                      <ConfirmButton
                        trigger={
                          <Button size="1" variant="soft" color="orange" aria-label={`Cancelar turno ${b.code}`}>
                            Cancelar
                          </Button>
                        }
                        title={`¿Cancelar el turno ${b.code}?`}
                        description={`${b.customer.name} · ${b.service.name} · ${shortDate(b.date)} ${b.time}. El horario vuelve a quedar libre.`}
                        action="Cancelar turno"
                        onConfirm={() => run(() => api.adminCancelBooking(adminKey, b.id), `Turno ${b.code} cancelado.`)}
                      />
                    )}
                    <ConfirmButton
                      trigger={
                        <Button size="1" variant="soft" color="red" aria-label={`Eliminar turno ${b.code}`}>
                          Eliminar
                        </Button>
                      }
                      title={`¿Eliminar el turno ${b.code}?`}
                      description="Se borra del sistema junto con su historial (para dejar registro, mejor cancelalo). No se puede deshacer."
                      action="Eliminar turno"
                      onConfirm={() => run(() => api.adminDeleteBooking(adminKey, b.id), `Turno ${b.code} eliminado.`)}
                    />
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>
      {editing && <BookingDialog booking={editing} onClose={() => setEditing(null)} onSaved={() => void load()} />}
    </>
  );
}
