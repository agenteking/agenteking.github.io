// Piezas chicas reusadas por las pestañas del panel.
import { AlertDialog, Button, Callout, Flex, Text } from "@radix-ui/themes";
import { useId, useState, type ReactElement, type ReactNode } from "react";

/** Etiqueta + control + error, accesible (el control recibe id y aria-invalid). */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="adm-field">
      <Text as="label" size="2" weight="medium" htmlFor={id}>
        {label}
      </Text>
      {children({ id, "aria-invalid": !!error, "aria-describedby": error || hint ? msgId : undefined })}
      {error ? (
        <Text id={msgId} size="1" color="red">
          {error}
        </Text>
      ) : hint ? (
        <Text id={msgId} size="1" color="gray">
          {hint}
        </Text>
      ) : null}
    </div>
  );
}

/** Botón que pide confirmación antes de una acción destructiva. */
export function ConfirmButton({
  trigger,
  title,
  description,
  action,
  onConfirm,
}: {
  trigger: ReactElement;
  title: string;
  description: ReactNode;
  action: string;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="440px">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description size="2">{description}</AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray">
              Volver
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button color="red" onClick={() => void onConfirm()}>
              {action}
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

/** Aviso de error o de bloqueo, con una acción opcional (p. ej. "Desactivar"). */
export function Notice({
  notice,
  onClose,
}: {
  notice: { message: string; action?: { label: string; run: () => void } } | null;
  onClose: () => void;
}) {
  if (!notice) return null;
  return (
    <Callout.Root color="red" size="1" mb="3" role="alert">
      <Callout.Text>{notice.message}</Callout.Text>
      <Flex gap="2" mt="1">
        {notice.action && (
          <Button size="1" onClick={notice.action.run}>
            {notice.action.label}
          </Button>
        )}
        <Button size="1" variant="ghost" color="gray" onClick={onClose}>
          Cerrar
        </Button>
      </Flex>
    </Callout.Root>
  );
}

export function useNotice() {
  return useState<{ message: string; action?: { label: string; run: () => void } } | null>(null);
}
