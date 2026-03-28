import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { Overlay } from "@/types";
import type { LinkMap } from "./useDictLinks";

function buildLinkMap(data: Record<string, string>[] | null, parentKey: string, childKey: string): LinkMap {
  const map: LinkMap = {};
  if (!data) return map;
  for (const row of data) {
    const pid = row[parentKey];
    if (!map[pid]) map[pid] = [];
    map[pid].push(row[childKey]);
  }
  return map;
}

export function useOverlays() {
  const { project } = useProject();
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [workTypeOverlays, setWorkTypeOverlays] = useState<LinkMap>({});
  const [overlayBuildings, setOverlayBuildings] = useState<LinkMap>({});
  const [overlayFloors, setOverlayFloors] = useState<LinkMap>({});
  const [overlayConstructions, setOverlayConstructions] = useState<LinkMap>({});
  const [overlayWorks, setOverlayWorks] = useState<LinkMap>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!project) return;
    setLoading(true);

    const [oRes, wtoRes, obRes, ofRes, ocRes, owRes] = await Promise.all([
      supabase.from("dict_overlays").select("id, name, storage_path, width, height, sort_order, tab_type").eq("project_id", project.id).order("sort_order"),
      supabase.from("dict_work_type_overlays").select("work_type_id, overlay_id"),
      supabase.from("dict_overlay_buildings").select("overlay_id, building_id"),
      supabase.from("dict_overlay_floors").select("overlay_id, floor_id"),
      supabase.from("dict_overlay_constructions").select("overlay_id, construction_id"),
      supabase.from("dict_overlay_works").select("overlay_id, work_id"),
    ]);

    setOverlays((oRes.data || []) as Overlay[]);
    setWorkTypeOverlays(buildLinkMap(wtoRes.data, "work_type_id", "overlay_id"));
    setOverlayBuildings(buildLinkMap(obRes.data, "overlay_id", "building_id"));
    setOverlayFloors(buildLinkMap(ofRes.data, "overlay_id", "floor_id"));
    setOverlayConstructions(buildLinkMap(ocRes.data, "overlay_id", "construction_id"));
    setOverlayWorks(buildLinkMap(owRes.data, "overlay_id", "work_id"));
    setLoading(false);
  }, [project]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    overlays,
    workTypeOverlays,
    overlayBuildings,
    overlayFloors,
    overlayConstructions,
    overlayWorks,
    loading,
    reload: load,
  };
}
