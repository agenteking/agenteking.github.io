import * as Dialog from "@radix-ui/react-dialog";
import { Suspense, lazy } from "react";
import { IconClose } from "./Icons";

// El flujo de reserva (Radix Themes + lógica) va en un chunk aparte: no pesa en la carga inicial.
const BookingFlow = lazy(() => import("../booking/BookingFlow"));

interface Props {
  open: boolean;
  serviceId?: string;
  onOpenChange: (open: boolean) => void;
}

export default function BookingSheet({ open, serviceId, onOpenChange }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
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
          <Dialog.Title className="sr-only">Reservar turno en Selkis Estudio</Dialog.Title>
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
            {open && <BookingFlow initialServiceId={serviceId} onDone={() => onOpenChange(false)} />}
          </Suspense>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
