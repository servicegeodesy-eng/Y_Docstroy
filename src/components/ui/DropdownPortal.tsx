import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface DropdownPortalProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  children: ReactNode;
  className?: string;
}

export default function DropdownPortal({ anchorRef, open, children, className = "" }: DropdownPortalProps) {
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    function update() {
      const rect = anchorRef.current!.getBoundingClientRect();
      const dropWidth = dropRef.current?.offsetWidth || 220;
      const dropHeight = dropRef.current?.offsetHeight || 256;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pad = 8; // отступ от края экрана

      // Горизонталь: правый край = правый край кнопки, но не выходит за экран
      let left = rect.right - dropWidth;
      if (left < pad) left = pad;
      if (left + dropWidth > vw - pad) left = vw - pad - dropWidth;

      // Вертикаль: ниже кнопки, но если не влезает — выше
      let top = rect.bottom + 4;
      if (top + dropHeight > vh - pad) {
        top = rect.top - dropHeight - 4;
        if (top < pad) top = pad;
      }

      setPos({ top, left });
    }
    update();
    // Повторный расчёт после рендера dropdown (когда dropRef.current.offsetWidth доступен)
    requestAnimationFrame(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={dropRef}
      data-dropdown-portal
      className={`fixed z-[9999] rounded-lg shadow-lg py-1 ${className}`}
      style={{
        top: pos.top,
        left: pos.left,
        background: "var(--ds-surface)",
        border: "1px solid var(--ds-border)",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
