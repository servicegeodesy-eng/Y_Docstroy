import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { DictionaryItem, Overlay } from "@/types";

export interface Dictionaries {
  buildings: DictionaryItem[];
  floors: DictionaryItem[];
  workTypes: DictionaryItem[];
  constructions: DictionaryItem[];
  sets: DictionaryItem[];
  works: DictionaryItem[];
  overlays: Overlay[];
}

const EMPTY: Dictionaries = {
  buildings: [], floors: [], workTypes: [], constructions: [], sets: [], works: [], overlays: [],
};

async function fetchDictionaries(projectId: string): Promise<Dictionaries> {
  const [b, f, wt, c, s, w, o] = await Promise.all([
    supabase.from("dict_buildings").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("dict_floors").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("dict_work_types").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("dict_constructions").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("dict_sets").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("dict_works").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("dict_overlays").select("*").eq("project_id", projectId).order("sort_order"),
  ]);
  return {
    buildings: (b.data || []) as DictionaryItem[],
    floors: (f.data || []) as DictionaryItem[],
    workTypes: (wt.data || []) as DictionaryItem[],
    constructions: (c.data || []) as DictionaryItem[],
    sets: (s.data || []) as DictionaryItem[],
    works: (w.data || []) as DictionaryItem[],
    overlays: (o.data || []) as Overlay[],
  };
}

export function useDictionaries() {
  const { project } = useProject();
  const queryClient = useQueryClient();
  const pid = project?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["dictionaries", pid],
    queryFn: () => fetchDictionaries(pid!),
    enabled: !!pid,
    staleTime: 10 * 60 * 1000,
  });

  const dicts = data || EMPTY;

  return {
    ...dicts,
    loading: isLoading,
    loadDicts: () => {
      queryClient.invalidateQueries({ queryKey: ["dictionaries", pid] });
    },
  };
}
