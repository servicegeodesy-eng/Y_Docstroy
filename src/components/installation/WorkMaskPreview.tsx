import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getOverlayUrl } from "@/lib/overlayUrlCache";

interface MaskData {
  id: string;
  overlay_id: string;
  polygon_points: { x: number; y: number }[];
}

interface OverlayData {
  id: string;
  name: string;
  storage_path: string;
  width: number;
  height: number;
}

interface Props {
  workId: string;
}

export default function WorkMaskPreview({ workId }: Props) {
  const [masks, setMasks] = useState<MaskData[]>([]);
  const [overlay, setOverlay] = useState<OverlayData | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      // Загружаем маски работы через generic CRUD
      const maskRes = await supabase
        .from("cell_overlay_masks")
        .select("id, overlay_id, polygon_points")
        .eq("work_id", workId);

      // polygon_points может прийти как строка — парсим
      const workMasks: MaskData[] = (maskRes.data || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        overlay_id: m.overlay_id as string,
        polygon_points: typeof m.polygon_points === "string" ? JSON.parse(m.polygon_points) : m.polygon_points as { x: number; y: number }[],
      }));

      if (cancelled) return;

      if (workMasks.length === 0) {
        setLoading(false);
        return;
      }

      setMasks(workMasks);

      // Загружаем подложку
      const overlayId = workMasks[0].overlay_id;
      const ovRes = await supabase
        .from("dict_overlays")
        .select("id, name, storage_path, width, height")
        .eq("id", overlayId)
        .maybeSingle();

      if (cancelled) return;

      if (ovRes.data) {
        const ov = ovRes.data as OverlayData;
        setOverlay(ov);
        const url = await getOverlayUrl(ov.storage_path);
        if (!cancelled) setImageUrl(url);
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [workId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4" style={{ color: "var(--ds-text-faint)" }}>
        <div className="ds-spinner w-4 h-4" />
      </div>
    );
  }

  if (masks.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-center" style={{ borderColor: "var(--ds-border)", background: "var(--ds-surface-sunken)" }}>
        <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Область на подложке не задана</p>
      </div>
    );
  }

  if (!overlay || !imageUrl) return null;

  const aspectW = 1000;
  const aspectH = (overlay.height / overlay.width) * aspectW;

  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--ds-border)" }}>
      <svg viewBox={`0 0 ${aspectW} ${aspectH}`} className="w-full h-auto" style={{ background: "var(--ds-surface-sunken)" }}>
        <image href={imageUrl} width={aspectW} height={aspectH} />
        {masks.map((mask) => {
          const points = (mask.polygon_points || [])
            .map((p) => `${p.x * aspectW},${p.y * aspectH}`)
            .join(" ");
          return (
            <polygon
              key={mask.id}
              points={points}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="6 3"
            />
          );
        })}
      </svg>
      <div className="px-2 py-1 text-[10px]" style={{ color: "var(--ds-text-faint)", background: "var(--ds-surface-sunken)" }}>
        {overlay.name}
      </div>
    </div>
  );
}
