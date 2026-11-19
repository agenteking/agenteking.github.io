import * as Dialog from "@radix-ui/react-dialog";
import { Suspense, lazy } from "react";
import { IconClose } from "./Icons";

// Los flujos (Radix Themes + lógica) van en chunks aparte: no pesan en la carga inicial.
const BookingFlow = lazy(() => import("../booking/BookingFlow"));
const ManageFlow = lazy(() => import("../booking/ManageFlow"));

export type SheetState =
  | { open: boolean; mode: "book"; serviceId?: string }
  | { open: boolean; mode: "manage"; prefill?: { code: string; contact: string } };

interface Props {
  state: SheetState;
  onChange: (s: SheetState) => void;
}

export default function BookingSheet({ state, onChange }: Props) {
  const close = () => onChange({ ...state, open: false });
  return (
    <Dialog.Root open={state.open} onOpenChange={(o) => onChange({ ...state, open: o })}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
          className="sheet"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Foco en el panel (no en la X) para que no aparezca el anillo de foco al abrir.
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus();
          }}
        >
          <div className="sheet-grabber" aria-hidden />
          <Dialog.Title className="sr-only">
            {state.mode === "manage" ? "Gestionar mi turno en Selkis Estudio" : "Reservar turno en Selkis Estudio"}
          </Dialog.Title>
          <Dialog.Close className="sheet-close" aria-label="Cerrar">
            <IconClose size={20} />
          </Dialog.Close>
          <Suspense
            fallback={
              <div className="sheet-loading" role="status">
                <span className="spinner" aria-hidden /> Cargando agenda…
              </div>
            }
          >
            {state.open && state.mode === "book" && (
              <BookingFlow
                initialServiceId={state.serviceId}
                onDone={close}
                onManage={(b) =>
                  onChange({ open: true, mode: "manage", prefill: { code: b.code, contact: b.customer.phone } })
                }
              />
            )}
            {state.open && state.mode === "manage" && (
              <ManageFlow
                key={state.prefill?.code ?? "manage"}
                prefill={state.prefill}
                onDone={close}
                onBook={() => onChange({ open: true, mode: "book" })}
              />
            )}
          </Suspense>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
