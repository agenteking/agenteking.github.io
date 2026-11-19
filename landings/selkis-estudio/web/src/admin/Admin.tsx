import "@radix-ui/themes/styles.css";
import "./admin.css";
import { Button, Callout, Card, Flex, Heading, Tabs, Text, TextField, Theme } from "@radix-ui/themes";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, STATIC_DEMO, api, errorMessage } from "../api";
import BookingsTab from "./BookingsTab";
import { AdminContext, type Catalog } from "./context";
import ProfessionalsTab from "./ProfessionalsTab";
import ServicesTab from "./ServicesTab";

const STORAGE = "selkis-admin-key";

function readKey() {
  try {
    return sessionStorage.getItem(STORAGE) ?? "";
  } catch {
    return "";
  }
}
function storeKey(k: string) {
  try {
    if (k) sessionStorage.setItem(STORAGE, k);
    else sessionStorage.removeItem(STORAGE);
  } catch {
    /* sin storage: no pasa nada */
  }
}

export default function Admin() {
  const [key, setKey] = useState(readKey);
  const [input, setInput] = useState("");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [tab, setTab] = useState("turnos");

  const logout = useCallback((msg: string | null = null) => {
    storeKey("");
    setKey("");
    setCatalog(null);
    setError(msg);
  }, []);

  const reloadCatalog = useCallback(async () => {
    try {
      // En serie, no en paralelo: una clave incorrecta cuenta como UN intento (el server frena a los 5 por IP).
      const s = await api.adminListServices(key);
      const p = await api.adminListProfessionals(key);
      setCatalog({ services: s.services, professionals: p.professionals });
      setError(null);
      storeKey(key);
    } catch (e) {
      // 401 o 429 (demasiados intentos): se borra la clave guardada y vuelve al login con el motivo.
      const status = e instanceof ApiError ? e.status : 0;
      logout(status === 401 ? "Clave incorrecta." : status === 429 ? errorMessage(e) : "No se pudo cargar el panel.");
    }
  }, [key, logout]);

  useEffect(() => {
    if (key) void reloadCatalog();
  }, [key, reloadCatalog]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 3500);
    return () => window.clearTimeout(t);
  }, [flash]);

  const login = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setKey(input.trim());
  };

  /** Errores de las pestañas: si la clave dejó de valer, vuelve al login. */
  const onError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) logout("La sesión venció: ingresá la clave de nuevo.");
      else if (e instanceof ApiError && e.status === 429) logout(errorMessage(e));
    },
    [logout],
  );

  return (
    <Theme accentColor="crimson" grayColor="mauve" radius="large">
      <div className="adm">
        <Flex justify="between" align="center" mb="5" wrap="wrap" gap="3">
          <div>
            <Heading size="7">Panel · Selkis Estudio</Heading>
            <Text color="gray" size="2">
              Turnos, servicios y equipo {STATIC_DEMO ? "· demo en tu navegador" : "· demo"}
            </Text>
          </div>
          <Flex gap="2">
            {catalog && (
              <Button variant="ghost" color="gray" onClick={() => logout()}>
                Salir
              </Button>
            )}
            <Button variant="soft" color="gray" asChild>
              <a href={import.meta.env.BASE_URL}>Ver sitio</a>
            </Button>
          </Flex>
        </Flex>

        {!catalog ? (
          <Card size="3" style={{ maxWidth: 420 }}>
            <form onSubmit={login}>
              <Flex direction="column" gap="3">
                <Text as="label" weight="bold" htmlFor="k">
                  Clave de administración
                </Text>
                <TextField.Root
                  id="k"
                  type="password"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  size="3"
                  autoComplete="current-password"
                />
                {error && (
                  <Callout.Root color="red" size="1" role="alert">
                    <Callout.Text>{error}</Callout.Text>
                  </Callout.Root>
                )}
                <Button size="3" type="submit" loading={!!key && !catalog && !error}>
                  Entrar
                </Button>
                <Text size="1" color="gray">
                  {STATIC_DEMO
                    ? "Demo: entrás con cualquier clave. Los datos quedan guardados solo en este navegador."
                    : "Demo: la clave está en la variable ADMIN_KEY del server (ver README)."}
                </Text>
              </Flex>
            </form>
          </Card>
        ) : (
          <AdminContext.Provider value={{ adminKey: key, catalog, reloadCatalog, flash: setFlash, onError }}>
            <div className="adm-flash" role="status" aria-live="polite">
              {flash && (
                <Callout.Root color="green" size="1">
                  <Callout.Text>{flash}</Callout.Text>
                </Callout.Root>
              )}
            </div>
            <Tabs.Root value={tab} onValueChange={setTab}>
              <Tabs.List size="2">
                <Tabs.Trigger value="turnos">Turnos</Tabs.Trigger>
                <Tabs.Trigger value="servicios">Servicios ({catalog.services.length})</Tabs.Trigger>
                <Tabs.Trigger value="equipo">Profesionales ({catalog.professionals.length})</Tabs.Trigger>
              </Tabs.List>
              <div className="adm-tab">
                <Tabs.Content value="turnos">
                  <BookingsTab />
                </Tabs.Content>
                <Tabs.Content value="servicios">
                  <ServicesTab />
                </Tabs.Content>
                <Tabs.Content value="equipo">
                  <ProfessionalsTab />
                </Tabs.Content>
              </div>
            </Tabs.Root>
          </AdminContext.Provider>
        )}
      </div>
    </Theme>
  );
}
