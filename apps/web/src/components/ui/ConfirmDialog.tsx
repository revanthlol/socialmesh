import { useEffect, useRef } from "react";
import { Button } from "./Button.js";

export function ConfirmDialog({
  title, description, confirmLabel = "Confirm", isBusy = false, onConfirm, onCancel,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) onCancel();
      if (event.key === "Tab") {
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isBusy, onCancel]);

  return <div className="confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isBusy) onCancel(); }}>
    <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-description">{description}</p>
      <div className="confirm-actions">
        <Button ref={cancelRef} variant="outline" size="sm" onClick={onCancel} disabled={isBusy}>Keep it</Button>
        <Button ref={confirmRef} variant="danger" size="sm" onClick={onConfirm} isLoading={isBusy}>{confirmLabel}</Button>
      </div>
    </section>
  </div>;
}
