import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CellOverlayMask } from "@/types";

export interface MaskWithCell extends CellOverlayMask {
  cell_name: string;
  cell_status: string;
  cell_updated_at: string;
  cell_progress_percent: number | null;
  cell_building_id: string | null;
  cell_work_type_id: string | null;
  cell_floor_id: string | null;
  cell_construction_id: string | null;
  cell_set_id: string | null;
}

export function useCellMasks(overlayId: string | null) {
  const [masks, setMasks] = useState<MaskWithCell[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!overlayId) {
      setMasks([]);
      return;
    }
    setLoading(true);

    const { data } = await supabase
      .from("cell_overlay_masks")
      .select(`
        *,
        cells!inner (
          name,
          status,
          updated_at,
          progress_percent,
          building_id,
          work_type_id,
          floor_id,
          construction_id,
          set_id,
          cell_type
        )
      `)
      .eq("overlay_id", overlayId)
      .eq("cells.cell_type", "registry");

    if (data) {
      setMasks(
        data.filter((row: any) => row.cells).map((row: { id: string; cell_id: string; overlay_id: string; polygon_points: { x: number; y: number }[]; created_at: string; updated_at: string; cells: { name: string; status: string; updated_at: string; progress_percent: number | null; building_id: string | null; work_type_id: string | null; floor_id: string | null; construction_id: string | null; set_id: string | null } }) => ({
          id: row.id,
          cell_id: row.cell_id,
          overlay_id: row.overlay_id,
          polygon_points: row.polygon_points,
          created_at: row.created_at,
          updated_at: row.updated_at,
          cell_name: row.cells.name,
          cell_status: row.cells.status,
          cell_updated_at: row.cells.updated_at,
          cell_progress_percent: row.cells.progress_percent,
          cell_building_id: row.cells.building_id,
          cell_work_type_id: row.cells.work_type_id,
          cell_floor_id: row.cells.floor_id,
          cell_construction_id: row.cells.construction_id,
          cell_set_id: row.cells.set_id,
        }))
      );
    }
    setLoading(false);
  }, [overlayId]);

  useEffect(() => {
    load();
  }, [load]);

  return { masks, loading, reload: load };
}
