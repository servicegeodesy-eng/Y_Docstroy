import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { ProfileShort } from "@/lib/utils";

export interface CellRow {
  id: string;
  name: string;
  status: string;
  progress_percent: number | null;
  tag: string | null;
  manual_tag: string | null;
  created_at: string;
  created_by: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  send_type: string | null;
  dict_buildings: { name: string } | null;
  dict_floors: { name: string } | null;
  dict_work_types: { name: string } | null;
  dict_constructions: { name: string } | null;
  dict_sets: { name: string } | null;
  cell_files: { id: string; file_name: string; storage_path: string }[];
  cell_comments: { count: number }[];
  cell_signatures: { status: string }[];
  creator: ProfileShort | null;
  assignee: ProfileShort | null;
  assigner: ProfileShort | null;
}

export type DataScope = 'initial' | 'filtered' | 'all';

export function useRegistryCells() {
  const { project } = useProject();
  const [cells, setCells] = useState<CellRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataScope, setDataScope] = useState<DataScope>('initial');

  const loadCells = useCallback(async (scope: DataScope = 'initial') => {
    if (!project) return;
    let query = supabase
      .from("cells")
      .select(`
        id, name, status, progress_percent, tag, manual_tag, created_at, created_by, assigned_to, assigned_by, send_type,
        dict_buildings(name),
        dict_floors(name),
        dict_work_types(name),
        dict_constructions(name),
        dict_sets(name),
        cell_files(id, file_name, storage_path),
        cell_comments(count),
        cell_signatures(status),
        creator:profiles!created_by(last_name, first_name, middle_name),
        assignee:profiles!assigned_to(last_name, first_name, middle_name),
        assigner:profiles!assigned_by(last_name, first_name, middle_name)
      `)
      .eq("project_id", project.id)
      .eq("cell_type", "registry")
      .order("created_at", { ascending: false });
    if (scope === 'initial') query = query.limit(100);
    else if (scope === 'filtered') query = query.limit(500);
    else query = query.limit(2000); // scope='all' — безопасный лимит
    const { data, error } = await query;
    if (error) {
      setLoadError("Не удалось загрузить реестр. Попробуйте обновить страницу.");
    } else {
      if (data) setCells(data as unknown as CellRow[]);
      setDataScope(scope);
      setLoadError(null);
    }
    setLoading(false);
  }, [project]);

  useEffect(() => {
    loadCells();
  }, [loadCells]);

  return { cells, setCells, loading, loadError, dataScope, loadCells };
}
