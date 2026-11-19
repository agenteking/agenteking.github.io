import { Badge, Button, Card, Checkbox, Dialog, Flex, Switch, Table, Text, TextField } from "@radix-ui/themes";
import { useMemo, useState, type FormEvent } from "react";
import { ApiError, api, errorMessage, fieldErrors, type AdminProfessional } from "../api";
import { useAdmin } from "./context";
import { ConfirmButton, Field, Notice, useNotice } from "./ui";

function ProfessionalDialog({ pro, onClose }: { pro: AdminProfessional | "new"; onClose: () => void }) {
  const { adminKey, catalog, reloadCatalog, flash, onError } = useAdmin();
  const isNew = pro === "new";
  const [form, setForm] = useState(() =>
    isNew
      ? { name: "", specialty: "", active: true, serviceIds: [] as string[] }
      : { name: pro.name, specialty: pro.specialty, active: pro.active, serviceIds: pro.serviceIds },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const grouped = useMemo(() => {
    const m = new Map<string, typeof catalog.services>();
    for (const s of catalog.services) m.set(s.category, [...(m.get(s.category) ?? []), s]);
    return [...m.entries()];
  }, [catalog.services]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      const saved = isNew
        ? await api.adminCreateProfessional(adminKey, form)
        : await api.adminUpdateProfessional(adminKey, pro.id, form);
      await reloadCatalog();
      flash(
        !form.active && saved.futureBookings > 0
          ? `${form.name} quedó inactiva. Tiene ${saved.futureBookings} turno(s) próximo(s): reasignalos desde Turnos.`
          : `${form.name} ${isNew ? "agregada al equipo" : "guardada"}.`,
      );
      onClose();
    } catch (err) {
      onError(err);
      if (err instanceof ApiError && err.body.issues) setErrors(fieldErrors(err));
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const toggle = (id: string, on: boolean) =>
    setForm((f) => ({ ...f, serviceIds: on ? [...f.serviceIds, id] : f.serviceIds.filter((x) => x !== id) }));

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Content maxWidth="560px">
        <Dialog.Title>{isNew ? "Nueva profesional" : `Editar a ${pro.name}`}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Aparece en "El equipo" del sitio y en la elección de profesional al reservar.
        </Dialog.Description>
        <form onSubmit={submit} noValidate>
          <Flex direction="column" gap="3">
            <Field label="Nombre" error={errors.name}>
              {(p) => <TextField.Root {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
            </Field>
            <Field label="Especialidad" error={errors.specialty} hint="Se muestra debajo del nombre (p. ej. Uñas & nail art).">
              {(p) => (
                <TextField.Root {...p} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
              )}
            </Field>
            <fieldset className="adm-fieldset">
              <legend>
                <Text size="2" weight="medium">
                  Servicios que hace
                </Text>
              </legend>
              {grouped.map(([cat, list]) => (
                <div key={cat} className="adm-check-group">
                  <Text as="p" size="1" color="gray" weight="bold">
                    {cat}
                  </Text>
                  <div className="adm-checks">
                    {list.map((s) => (
                      <Text as="label" size="2" key={s.id}>
                        <Flex gap="2" align="center">
                          <Checkbox checked={form.serviceIds.includes(s.id)} onCheckedChange={(c) => toggle(s.id, c === true)} />
                          {s.name}
                          {!s.active && (
                            <Badge color="gray" size="1">
                              inactivo
                            </Badge>
                          )}
                        </Flex>
                      </Text>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
            <Text as="label" size="2">
              <Flex gap="2" align="center">
                <Switch checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: c })} />
                Activa (se ve en el sitio y recibe turnos online)
              </Flex>
            </Text>
            {!isNew && !form.active && pro.active && pro.futureBookings > 0 && (
              <Text size="1" color="amber">
                Tiene {pro.futureBookings} turno(s) próximo(s): quedan en la agenda, reasignalos desde Turnos.
              </Text>
            )}
            {error && (
              <Text color="red" size="2" role="alert">
                {error}
              </Text>
            )}
            <Flex gap="3" justify="end" mt="2">
              <Dialog.Close>
                <Button type="button" variant="soft" color="gray">
                  Cancelar
                </Button>
              </Dialog.Close>
              <Button type="submit" loading={saving}>
                {isNew ? "Agregar profesional" : "Guardar"}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default function ProfessionalsTab() {
  const { adminKey, catalog, reloadCatalog, flash, onError } = useAdmin();
  const [editing, setEditing] = useState<AdminProfessional | "new" | null>(null);
  const [notice, setNotice] = useNotice();
  const serviceName = new Map(catalog.services.map((s) => [s.id, s.name]));

  async function setActive(p: AdminProfessional, active: boolean) {
    try {
      await api.adminUpdateProfessional(adminKey, p.id, { ...p, active });
      await reloadCatalog();
      setNotice(null);
      flash(
        !active && p.futureBookings > 0
          ? `${p.name} quedó inactiva. Tiene ${p.futureBookings} turno(s) próximo(s): reasignalos desde Turnos.`
          : `${p.name} ${active ? "activada" : "desactivada"}.`,
      );
    } catch (e) {
      onError(e);
      setNotice({ message: errorMessage(e) });
    }
  }

  async function remove(p: AdminProfessional) {
    try {
      await api.adminDeleteProfessional(adminKey, p.id);
      await reloadCatalog();
      setNotice(null);
      flash(`${p.name} eliminada del equipo.`);
    } catch (e) {
      onError(e);
      const blocked = e instanceof ApiError && e.status === 409;
      setNotice({
        message: errorMessage(e),
        action: blocked && p.active ? { label: `Desactivar a ${p.name}`, run: () => void setActive(p, false) } : undefined,
      });
    }
  }

  return (
    <>
      <Flex justify="between" align="center" mb="3" wrap="wrap" gap="3">
        <Text size="2" color="gray">
          Las activas aparecen en el sitio y en la reserva online.
        </Text>
        <Button onClick={() => setEditing("new")}>Nueva profesional</Button>
      </Flex>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <Card className="adm-card">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Profesional</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Servicios</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Estado</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <span className="sr-only">Acciones</span>
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {catalog.professionals.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={4}>
                  <Text color="gray">No hay profesionales cargadas.</Text>
                </Table.Cell>
              </Table.Row>
            )}
            {catalog.professionals.map((p) => (
              <Table.Row key={p.id}>
                <Table.RowHeaderCell>
                  <Text weight="bold">{p.name}</Text>
                  <br />
                  <Text color="gray" size="1">
                    {p.specialty || "—"}
                  </Text>
                </Table.RowHeaderCell>
                <Table.Cell>
                  {p.serviceIds.length === 0 ? (
                    <Badge color="amber">Sin servicios</Badge>
                  ) : (
                    <Text size="2">{p.serviceIds.map((id) => serviceName.get(id) ?? id).join(", ")}</Text>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Badge color={p.active ? "green" : "gray"}>{p.active ? "Activa" : "Inactiva"}</Badge>
                  {p.futureBookings > 0 && (
                    <Text as="div" size="1" color="gray">
                      {p.futureBookings} turno{p.futureBookings === 1 ? "" : "s"} próximo{p.futureBookings === 1 ? "" : "s"}
                    </Text>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2" wrap="wrap">
                    <Button size="1" variant="soft" onClick={() => setEditing(p)} aria-label={`Editar a ${p.name}`}>
                      Editar
                    </Button>
                    <Button
                      size="1"
                      variant="soft"
                      color="gray"
                      onClick={() => void setActive(p, !p.active)}
                      aria-label={`${p.active ? "Desactivar" : "Activar"} a ${p.name}`}
                    >
                      {p.active ? "Desactivar" : "Activar"}
                    </Button>
                    <ConfirmButton
                      trigger={
                        <Button size="1" variant="soft" color="red" aria-label={`Eliminar a ${p.name}`}>
                          Eliminar
                        </Button>
                      }
                      title={`¿Eliminar a ${p.name}?`}
                      description="Se borra del equipo. Si tiene turnos (próximos o pasados) no se puede: desactivala para que deje de aparecer en el sitio."
                      action="Eliminar profesional"
                      onConfirm={() => remove(p)}
                    />
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>
      {editing && <ProfessionalDialog pro={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
