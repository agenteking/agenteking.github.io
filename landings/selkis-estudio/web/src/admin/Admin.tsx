import "@radix-ui/themes/styles.css";
import { AlertDialog, Badge, Button, Callout, Card, Flex, Heading, SegmentedControl, Table, Text, TextField, Theme } from "@radix-ui/themes";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, STATIC_DEMO, cancelBooking, listBookings, type Booking } from "../api";

const STORAGE = "selkis-admin-key";

function readKey() {
  try {
    return sessionStorage.getItem(STORAGE) ?? "";
  } catch {
    return "";
  }
}

export default function Admin() {
  const [key, setKey] = useState(readKey);
  const [input, setInput] = useState("");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "all" | "cancelled">("upcoming");

  const load = useCallback(async (k: string) => {
    try {
      const r = await listBookings(k);
      setBookings(r.bookings);
      setError(null);
      try {
        sessionStorage.setItem(STORAGE, k);
      } catch {
        /* sin storage: no pasa nada */
      }
    } catch (e) {
      setBookings(null);
      setKey("");
      setError(e instanceof ApiError && e.status === 401 ? "Clave incorrecta." : "No se pudo cargar la agenda.");
    }
  }, []);

  useEffect(() => {
    if (key) void load(key);
  }, [key, load]);

  const login = (e: FormEvent) => {
    e.preventDefault();
    setKey(input.trim());
  };

  const cancel = async (id: string) => {
    await cancelBooking(key, id);
    await load(key);
  };

  const now = new Date().toISOString().slice(0, 10);
  const shown = (bookings ?? []).filter((b) =>
    filter === "all" ? true : filter === "cancelled" ? b.status === "cancelled" : b.status === "confirmed" && b.date >= now,
  );

  return (
    <Theme accentColor="crimson" grayColor="mauve" radius="large">
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 16px 64px" }}>
        <Flex justify="between" align="center" mb="5" wrap="wrap" gap="3">
          <div>
            <Heading size="7">Agenda · Selkis Estudio</Heading>
            <Text color="gray" size="2">
              Panel de demo
            </Text>
          </div>
          <Button variant="soft" color="gray" asChild>
            <a href={import.meta.env.BASE_URL}>Ver sitio</a>
          </Button>
        </Flex>

        {!bookings ? (
          <Card size="3" style={{ maxWidth: 420 }}>
            <form onSubmit={login}>
              <Flex direction="column" gap="3">
                <Text as="label" weight="bold" htmlFor="k">
                  Clave de administración
                </Text>
                <TextField.Root id="k" type="password" value={input} onChange={(e) => setInput(e.target.value)} size="3" />
                {error && (
                  <Callout.Root color="red" size="1">
                    <Callout.Text>{error}</Callout.Text>
                  </Callout.Root>
                )}
                <Button size="3" type="submit">
                  Entrar
                </Button>
                <Text size="1" color="gray">
                  {STATIC_DEMO
                    ? "Demo: entrás con cualquier clave. Los turnos quedan guardados solo en este navegador."
                    : "Demo: la clave por defecto está en el README (variable ADMIN_KEY)."}
                </Text>
              </Flex>
            </form>
          </Card>
        ) : (
          <>
            <Flex justify="between" align="center" mb="3" wrap="wrap" gap="3">
              <SegmentedControl.Root value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <SegmentedControl.Item value="upcoming">Próximos</SegmentedControl.Item>
                <SegmentedControl.Item value="cancelled">Cancelados</SegmentedControl.Item>
                <SegmentedControl.Item value="all">Todos</SegmentedControl.Item>
              </SegmentedControl.Root>
              <Button variant="soft" onClick={() => load(key)}>
                Actualizar
              </Button>
            </Flex>
            <Card>
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Cuándo</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Servicio</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Clienta</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Profesional</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Estado</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {shown.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={6}>
                        <Text color="gray">No hay turnos acá.</Text>
                      </Table.Cell>
                    </Table.Row>
                  )}
                  {shown.map((b) => (
                    <Table.Row key={b.id}>
                      <Table.RowHeaderCell>
                        <Text weight="bold">{b.date}</Text>
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
                          {b.customer.phone} · {b.customer.email}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>{b.professional.name}</Table.Cell>
                      <Table.Cell>
                        <Badge color={b.status === "confirmed" ? "green" : "gray"}>
                          {b.status === "confirmed" ? "Confirmado" : "Cancelado"}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {b.status === "confirmed" && (
                          <AlertDialog.Root>
                            <AlertDialog.Trigger>
                              <Button size="1" color="red" variant="soft">
                                Cancelar
                              </Button>
                            </AlertDialog.Trigger>
                            <AlertDialog.Content maxWidth="420px">
                              <AlertDialog.Title>¿Cancelar el turno {b.code}?</AlertDialog.Title>
                              <AlertDialog.Description size="2">
                                {b.customer.name} · {b.service.name} · {b.date} {b.time}. El horario vuelve a quedar libre.
                              </AlertDialog.Description>
                              <Flex gap="3" mt="4" justify="end">
                                <AlertDialog.Cancel>
                                  <Button variant="soft" color="gray">
                                    Volver
                                  </Button>
                                </AlertDialog.Cancel>
                                <AlertDialog.Action>
                                  <Button color="red" onClick={() => void cancel(b.id)}>
                                    Cancelar turno
                                  </Button>
                                </AlertDialog.Action>
                              </Flex>
                            </AlertDialog.Content>
                          </AlertDialog.Root>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Card>
          </>
        )}
      </div>
    </Theme>
  );
}
