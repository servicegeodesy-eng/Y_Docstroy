import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { AxisGrid, AxisGridAxis } from "@/types";

export function useAxisGrids() {
  const { project } = useProject();
  const [grids, setGrids] = useState<AxisGrid[]>([]);
  const [axes, setAxes] = useState<AxisGridAxis[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    const [gRes, aRes] = await Promise.all([
      supabase.from("dict_axis_grids").select("*").eq("project_id", project.id).order("sort_order"),
      supabase.from("dict_axis_grid_axes").select("*").order("sort_order"),
    ]);
    setGrids(gRes.data || []);
    setAxes(aRes.data || []);
    setLoading(false);
  }, [project]);

  useEffect(() => {
    load();
  }, [load]);

  /** Оси для конкретной сетки */
  function axesForGrid(gridId: string): AxisGridAxis[] {
    return axes.filter((a) => a.grid_id === gridId);
  }

  return { grids, axes, axesForGrid, loading, reload: load };
}
