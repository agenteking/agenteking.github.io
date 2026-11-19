import { Badge, Button, Card, Checkbox, Dialog, Flex, Switch, Table, Text, TextArea, TextField } from "@radix-ui/themes";
import { useState, type FormEvent } from "react";
import { ApiError, api, errorMessage, fieldErrors, formatARS, formatDuration, type AdminService } from "../api";
import { useAdmin } from "./context";
import { ConfirmButton, Field, Notice, useNotice } from "./ui";

const empty = { name: "", category: "", description: "", durationMin: "60", priceFrom: "", active: true, professionalIds: [] as string[] };

function ServiceDialog({ service, onClose }: { service: AdminService | "new"; onClose: () => void }) {
  const { adminKey, catalog, reloadCatalog, flash, onError } = useAdmin();
  const isNew = service === "new";
  const [form, setForm] = useState(() =>
    isNew
      ? empty
      : {
          name: service.name,
          category: service.category,
          description: service.description,
          durationMin: String(service.durationMin),
          priceFrom: String(service.priceFrom),
          active: service.active,
          professionalIds: service.professionalIds,
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const categories = [...new Set(catalog.services.map((s) => s.category))];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setErrors({});
    const body = {
      ...form,
      durationMin: form.durationMin === "" ? Number.NaN : Number(form.durationMin),
      priceFrom: form.priceFrom === "" ? Number.NaN : Number(form.priceFrom.replace(/[.\s$]/g, "")),
    };
    try {
      if (isNew) await api.adminCreateService(adminKey, body);
      else await api.adminUpdateService(adminKey, service.id, body);
      await reloadCatalog();
      flash(isNew ? `Servicio "${form.name}" creado.` : `Servicio "${form.name}" guardado.`);
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
    setForm((f) => ({ ...f, professionalIds: on ? [...f.professionalIds, id] : f.professionalIds.filter((x) => x !== id) }));

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Content maxWidth="560px">
        <Dialog.Title>{isNew ? "Nuevo servicio" : `Editar "${service.name}"`}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Lo que guardes acá se ve al instante en el sitio (lista de servicios, precios y reserva).
        </Dialog.Description>
        <form onSubmit={submit} noValidate>
          <Flex direction="column" gap="3">
            <Field label="Nombre" error={errors.name}>
              {(p) => <TextField.Root {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
            </Field>
            <Field label="Categoría" error={errors.category} hint="Agrupa los servicios en el sitio (p. ej. Uñas, Pies).">
              {(p) => (
                <>
                  <TextField.Root
                    {...p}
                    list="adm-categories"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                  <datalist id="adm-categories">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Descripción" error={errors.description}>
              {(p) => (
                <TextArea {...p} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              )}
            </Field>
            <div className="adm-grid2">
              <Field label="Duración (minutos)" error={errors.durationMin} hint="Múltiplos de 15.">
                {(p) => (
                  <TextField.Root
                    {...p}
                    type="number"
                    inputMode="numeric"
                    min={15}
                    step={15}
                    value={form.durationMin}
                    onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Precio desde ($)" error={errors.priceFrom}>
                {(p) => (
                  <TextField.Root
                    {...p}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={500}
                    value={form.priceFrom}
                    onChange={(e) => setForm({ ...form, priceFrom: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <fieldset className="adm-fieldset">
              <legend>
                <Text size="2" weight="medium">
                  Quiénes lo hacen
                </Text>
              </legend>
              {catalog.professionals.length === 0 && (
                <Text size="1" color="gray">
                  Todavía no hay profesionales cargadas.
                </Text>
              )}
              <div className="adm-checks">
                {catalog.professionals.map((p) => (
                  <Text as="label" size="2" key={p.id}>
                    <Flex gap="2" align="center">
                      <Checkbox checked={form.professionalIds.includes(p.id)} onCheckedChange={(c) => toggle(p.id, c === true)} />
                      {p.name}
                      {!p.active && (
                        <Badge color="gray" size="1">
                          inactiva
                        </Badge>
                      )}
                    </Flex>
                  </Text>
                ))}
              </div>
              {form.professionalIds.length === 0 && (
                <Text size="1" color="amber">
                  Sin profesionales el servicio no aparece en el sitio.
                </Text>
              )}
            </fieldset>
            <Text as="label" size="2">
              <Flex gap="2" align="center">
                <Switch checked={form.active} onCheckedChange={(c) => setForm({ ...form, active: c })} />
                Activo (se ve en el sitio y se puede reservar)
              </Flex>
            </Text>
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
                {isNew ? "Crear servicio" : "Guardar"}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default function ServicesTab() {
  const { adminKey, catalog, reloadCatalog, flash, onError } = useAdmin();
  const [editing, setEditing] = useState<AdminService | "new" | null>(null);
  const [notice, setNotice] = useNotice();
  const proName = new Map(catalog.professionals.map((p) => [p.id, p.name]));

  async function setActive(s: AdminService, active: boolean) {
    try {
      await api.adminUpdateService(adminKey, s.id, { ...s, active });
      await reloadCatalog();
      setNotice(null);
      flash(`"${s.name}" ${active ? "activado" : "desactivado"}.`);
    } catch (e) {
      onError(e);
      setNotice({ message: errorMessage(e) });
    }
  }

  async function remove(s: AdminService) {
    try {
      await api.adminDeleteService(adminKey, s.id);
      await reloadCatalog();
      setNotice(null);
      flash(`"${s.name}" eliminado.`);
    } catch (e) {
      onError(e);
      const blocked = e instanceof ApiError && e.status === 409;
      setNotice({
        message: errorMessage(e),
        action: blocked && s.active ? { label: `Desactivar "${s.name}"`, run: () => void setActive(s, false) } : undefined,
      });
    }
  }

  return (
    <>
      <Flex justify="between" align="center" mb="3" wrap="wrap" gap="3">
        <Text size="2" color="gray">
          Los precios y servicios activos son los que muestra el sitio.
        </Text>
        <Button onClick={() => setEditing("new")}>Nuevo servicio</Button>
      </Flex>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <Card className="adm-card">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Servicio</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Duración</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Precio desde</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Profesionales</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Estado</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                <span className="sr-only">Acciones</span>
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {catalog.services.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={6}>
                  <Text color="gray">No hay servicios cargados.</Text>
                </Table.Cell>
              </Table.Row>
            )}
            {catalog.services.map((s) => (
              <Table.Row key={s.id}>
                <Table.RowHeaderCell>
                  <Text weight="bold">{s.name}</Text>
                  <br />
                  <Text color="gray" size="1">
                    {s.category}
                  </Text>
                </Table.RowHeaderCell>
                <Table.Cell className="adm-nowrap">{formatDuration(s.durationMin)}</Table.Cell>
                <Table.Cell className="adm-nowrap">{formatARS(s.priceFrom)}</Table.Cell>
                <Table.Cell>
                  {s.professionalIds.length === 0 ? (
                    <Badge color="amber">Sin profesionales</Badge>
                  ) : (
                    <Text size="2">{s.professionalIds.map((id) => proName.get(id) ?? id).join(", ")}</Text>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Badge color={s.active ? "green" : "gray"}>{s.active ? "Activo" : "Inactivo"}</Badge>
                  {s.futureBookings > 0 && (
                    <Text as="div" size="1" color="gray">
                      {s.futureBookings} turno{s.futureBookings === 1 ? "" : "s"} próximo{s.futureBookings === 1 ? "" : "s"}
                    </Text>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2" wrap="wrap">
                    <Button size="1" variant="soft" onClick={() => setEditing(s)} aria-label={`Editar ${s.name}`}>
                      Editar
                    </Button>
                    <Button
                      size="1"
                      variant="soft"
                      color="gray"
                      onClick={() => void setActive(s, !s.active)}
                      aria-label={`${s.active ? "Desactivar" : "Activar"} ${s.name}`}
                    >
                      {s.active ? "Desactivar" : "Activar"}
                    </Button>
                    <ConfirmButton
                      trigger={
                        <Button size="1" variant="soft" color="red" aria-label={`Eliminar ${s.name}`}>
                          Eliminar
                        </Button>
                      }
                      title={`¿Eliminar "${s.name}"?`}
                      description="Se borra del sistema. Si tiene turnos (próximos o pasados) no se puede: desactivalo para que deje de verse en el sitio."
                      action="Eliminar servicio"
                      onConfirm={() => remove(s)}
                    />
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>
      {editing && <ServiceDialog service={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
