import { useEffect, type ReactNode } from "react";
import { useMobile } from "@/lib/MobileContext";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  /** Дополнительные элементы в заголовке (слева от крестика) */
  headerExtra?: ReactNode;
}

export default function Modal({ open, onClose, title, children, wide, headerExtra }: ModalProps) {
  const { isMobile } = useMobile();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ds-overlay">
      <div className="ds-overlay-bg" onClick={onClose} />
      <div
        className={`ds-modal ${
          isMobile
            ? "w-full h-full max-h-full rounded-none"
            : wide
              ? "w-full max-w-2xl"
              : "w-full max-w-md"
        }`}
        style={isMobile ? { borderRadius: 0 } : undefined}
      >
        <div className={`ds-modal-header ${isMobile ? "px-4 py-3" : ""}`} style={isMobile ? { borderRadius: 0 } : undefined}>
          <h3 className={`ds-modal-title ${isMobile ? "text-base" : ""}`}>{title}</h3>
          <div className="flex items-center gap-2">
            {headerExtra}
            <button onClick={onClose} className="ds-icon-btn">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className={isMobile ? "px-4 py-3" : "px-6 py-4"}>{children}</div>
      </div>
    </div>
  );
}
