import { useEffect, useRef } from "react";

export function useModalFocus<T extends HTMLElement>(open: boolean, close: () => void, busy = false) {
  const ref = useRef<T>(null);
  const current = useRef({ close, busy });
  current.current = { close, busy };
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length > 0);
    (controls()[0] ?? dialog).focus();
    const keydown = (event: KeyboardEvent) => {
      // A nested confirmation owns focus until it closes.
      if (Array.from(document.querySelectorAll('[aria-modal="true"]')).at(-1) !== dialog) return;
      if (event.key === "Escape" && !current.current.busy) { event.preventDefault(); current.current.close(); }
      if (event.key !== "Tab") return;
      const items = controls(), first = items[0], last = items.at(-1);
      if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [open]);
  return ref;
}
