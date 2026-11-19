import * as Dialog from "@radix-ui/react-dialog";
import { NAV } from "../content";
import { ArrowRight, Cross } from "./Icons";

/** Menú del celu (Radix Dialog). Se carga recién al tocar el botón: no pesa en la carga inicial. */
export default function MobileMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const close = () => onOpenChange(false);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet__overlay" />
        <Dialog.Content
          className="sheet"
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            // No hay Dialog.Trigger (el botón vive fuera del chunk): devolvemos el foco a mano.
            e.preventDefault();
            document.querySelector<HTMLButtonElement>(".nav__menu")?.focus({ preventScroll: true });
          }}
        >
          <div className="sheet__top">
            <Dialog.Title className="sheet__title">Menú</Dialog.Title>
            <Dialog.Close className="sheet__close" aria-label="Cerrar menú">
              <Cross />
            </Dialog.Close>
          </div>
          <nav aria-label="Secciones">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} onClick={close}>
                {n.label}
                <ArrowRight width={18} height={18} />
              </a>
            ))}
          </nav>
          <a href="#contacto" className="btn btn--primary btn--lg btn--block" onClick={close}>
            Pedí tu demo gratis
          </a>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
