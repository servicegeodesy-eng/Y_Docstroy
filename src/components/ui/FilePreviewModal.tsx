import { memo, useEffect, useState, useRef, useCallback, type MouseEvent as ReactMouseEvent } from "react";
import { useMobile } from "@/lib/MobileContext";
import { getPreviewType, getStorageBlobUrl, getStorageTextContent, downloadStorage } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface Props {
  fileName: string;
  storagePath: string;
  onClose: () => void;
  /** Если указан — загрузка из этого bucket вместо cell-files */
  bucket?: string;
}

function FilePreviewModal({ fileName, storagePath, onClose, bucket }: Props) {
  const { isMobile } = useMobile();
  const previewType = getPreviewType(fileName);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Zoom state
  const [zoom, setZoom] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 5;

  // Rotation state
  const [rotation, setRotation] = useState(0);

  const rotateLeft = useCallback(() => setRotation((r) => (r - 90) % 360), []);
  const rotateRight = useCallback(() => setRotation((r) => (r + 90) % 360), []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setTranslate({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(z * 1.3, MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(z / 1.3, MIN_ZOOM));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadBlob(): Promise<Blob | null> {
      if (bucket) {
        const { data } = await supabase.storage.from(bucket).download(storagePath);
        return data;
      }
      const { downloadFile } = await import("@/lib/fileStorage");
      return downloadFile(storagePath);
    }

    async function load() {
      setLoading(true);
      setError(false);
      if (previewType === "text") {
        if (bucket) {
          const blob = await loadBlob();
          if (cancelled) return;
          if (!blob) { setError(true); } else { setTextContent(await blob.text()); }
        } else {
          const text = await getStorageTextContent(storagePath);
          if (cancelled) return;
          if (text === null) { setError(true); } else { setTextContent(text); }
        }
      } else {
        if (bucket) {
          const blob = await loadBlob();
          if (cancelled) return;
          if (!blob) { setError(true); } else { setBlobUrl(URL.createObjectURL(blob)); }
        } else {
          const url = await getStorageBlobUrl(storagePath);
          if (cancelled) return;
          if (url === null) { setError(true); } else { setBlobUrl(url); }
        }
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [storagePath, previewType]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Mouse wheel zoom
  useEffect(() => {
    if (previewType !== "image") return;
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setZoom((z) => Math.min(Math.max(z * factor, MIN_ZOOM), MAX_ZOOM));
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [previewType, blobUrl]);

  // Mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      setTranslate({
        x: dragStart.current.tx + (e.clientX - dragStart.current.x),
        y: dragStart.current.ty + (e.clientY - dragStart.current.y),
      });
    };
    const handleUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging]);

  // Touch: pinch-to-zoom + drag
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.hypot(dx, dy);
      lastTouchCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1 && zoom > 1) {
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: translate.x, ty: translate.y };
      setDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastTouchDist.current !== null) {
        const factor = dist / lastTouchDist.current;
        setZoom((z) => Math.min(Math.max(z * factor, MIN_ZOOM), MAX_ZOOM));
      }
      lastTouchDist.current = dist;
    } else if (e.touches.length === 1 && dragging) {
      setTranslate({
        x: dragStart.current.tx + (e.touches[0].clientX - dragStart.current.x),
        y: dragStart.current.ty + (e.touches[0].clientY - dragStart.current.y),
      });
    }
  };

  const handleTouchEnd = () => {
    lastTouchDist.current = null;
    lastTouchCenter.current = null;
    setDragging(false);
  };

  // Double-tap to toggle zoom on mobile
  const lastTap = useRef(0);
  const handleDoubleTap = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (zoom > 1) {
        resetZoom();
      } else {
        setZoom(2.5);
      }
    }
    lastTap.current = now;
  };

  // Закрытие по клику на фон: только если mousedown начался на самом фоне
  // (предотвращает «призрачный клик» от портала дропдауна, который удалился из DOM)
  const bgMouseDownRef = useRef(false);
  const handleBgMouseDown = useCallback((e: ReactMouseEvent) => {
    if (e.target === e.currentTarget) bgMouseDownRef.current = true;
  }, []);
  const handleBgClick = useCallback((e: ReactMouseEvent) => {
    if (bgMouseDownRef.current && e.target === e.currentTarget) onClose();
    bgMouseDownRef.current = false;
  }, [onClose]);

  const isImage = previewType === "image" && blobUrl;

  return (
    <div className="ds-overlay">
      <div className="ds-overlay-bg" onMouseDown={handleBgMouseDown} onClick={handleBgClick} />
      <div
        className={`ds-modal flex flex-col !overflow-hidden ${
          isMobile
            ? "w-full h-full max-h-full rounded-none mx-0"
            : "mx-4 w-full max-w-5xl max-h-[92vh]"
        }`}
        style={isMobile ? { borderRadius: 0 } : undefined}
      >
        {/* Header */}
        <div className={`ds-modal-header ${isMobile ? "px-3 py-2" : ""}`} style={isMobile ? { borderRadius: 0 } : undefined}>
          <h3 className={`ds-modal-title truncate mr-4 ${isMobile ? "text-sm" : "text-sm"}`}>{fileName}</h3>
          <div className="flex items-center gap-1">
            {isImage && (
              <>
                <button onClick={zoomOut} className="ds-icon-btn" title="Уменьшить">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                <span className="text-xs min-w-[3rem] text-center" style={{ color: "var(--ds-text-muted)" }}>
                  {Math.round(zoom * 100)}%
                </span>
                <button onClick={zoomIn} className="ds-icon-btn" title="Увеличить">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                </button>
                <div className="w-px h-4 mx-0.5" style={{ background: "var(--ds-border)" }} />
                <button onClick={rotateLeft} className="ds-icon-btn" title="Повернуть влево">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h4V6" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10a9 9 0 0118 0 9 9 0 01-9 9 9 9 0 01-6.36-2.64" />
                  </svg>
                </button>
                <button onClick={rotateRight} className="ds-icon-btn" title="Повернуть вправо">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-4V6" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10a9 9 0 00-18 0 9 9 0 009 9 9 9 0 006.36-2.64" />
                  </svg>
                </button>
                {(zoom !== 1 || rotation !== 0) && (
                  <button onClick={resetZoom} className="ds-icon-btn" title="Сбросить">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </>
            )}
            <button onClick={async () => {
              if (bucket) {
                const { data } = await supabase.storage.from(bucket).download(storagePath);
                if (data) { const url = URL.createObjectURL(data); const a = document.createElement("a"); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url); }
              } else {
                downloadStorage(storagePath, fileName);
              }
            }} className="ds-icon-btn" title="Скачать">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button onClick={onClose} className="ds-icon-btn">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden min-h-0">
          {loading ? (
            <div className={`flex items-center justify-center ${isMobile ? "h-64" : "h-96"}`}>
              <div className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
            </div>
          ) : error ? (
            <div className={`flex items-center justify-center ${isMobile ? "h-64" : "h-96"}`}>
              <div className="text-sm" style={{ color: "#ef4444" }}>Не удалось загрузить файл</div>
            </div>
          ) : previewType === "pdf" && blobUrl ? (
            <iframe
              src={blobUrl}
              className={`w-full h-full ${isMobile ? "min-h-[calc(100vh-56px)]" : "min-h-[75vh]"}`}
              title={fileName}
            />
          ) : isImage ? (
            <div
              ref={containerRef}
              className={`overflow-hidden h-full ${isMobile ? "max-h-[calc(100vh-56px)]" : "max-h-[80vh]"}`}
              style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default", touchAction: "none" }}
              onMouseDown={handleMouseDown}
              onTouchStart={(e) => { handleDoubleTap(e); handleTouchStart(e); }}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className="flex items-center justify-center w-full h-full"
                style={{
                  transform: `translate(${translate.x}px, ${translate.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transition: dragging ? "none" : "transform 0.15s ease-out",
                  transformOrigin: "center center",
                }}
              >
                <img
                  src={blobUrl}
                  alt={fileName}
                  className="object-contain rounded select-none"
                  style={{ maxWidth: "100%", maxHeight: isMobile ? "calc(100vh - 80px)" : "75vh" }}
                  draggable={false}
                />
              </div>
            </div>
          ) : previewType === "text" && textContent !== null ? (
            <div className={`overflow-auto h-full ${isMobile ? "p-2 max-h-[calc(100vh-56px)]" : "p-4 max-h-[80vh]"}`}>
              <pre
                className={`font-mono whitespace-pre-wrap break-words rounded-xl min-h-[200px] ${isMobile ? "text-xs p-3" : "text-sm p-4"}`}
                style={{
                  background: "var(--ds-surface-sunken)",
                  color: "var(--ds-text)",
                }}
              >
                {textContent}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


export default memo(FilePreviewModal);
