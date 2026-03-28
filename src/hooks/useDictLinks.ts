import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { DictionaryItem } from "@/types";

export type LinkMap = Record<string, string[]>;

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

/** Составной ключ для трёхсторонних связей (building + workType → floors) */
export function compositeKey(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a || !b) return null;
  return `${a}:${b}`;
}

/**
 * Фильтрация дочерних элементов по выбранному родителю.
 * - Если parentId не задан → все элементы.
 * - Если связи вообще не настроены (linkMap пуст) → все элементы.
 * - Если связи настроены, но для данного parent нет записей → пустой массив (disabled).
 */
export function filterChildren(
  allItems: DictionaryItem[],
  linkMap: LinkMap,
  parentId: string | null | undefined,
): DictionaryItem[] {
  if (!parentId) return allItems;
  const hasAnyLinks = Object.keys(linkMap).length > 0;
  if (!hasAnyLinks) return allItems;
  const linked = linkMap[parentId];
  if (!linked || linked.length === 0) return [];
  return allItems.filter((item) => linked.includes(item.id));
}

/**
 * Проверяет, должен ли дочерний селект быть неактивным.
 * true, если: родитель выбран, связи настроены, но для этого родителя их нет.
 */
export function isChildLocked(
  linkMap: LinkMap,
  parentId: string | null | undefined,
): boolean {
  if (!parentId) return false;
  const hasAnyLinks = Object.keys(linkMap).length > 0;
  if (!hasAnyLinks) return false;
  const linked = linkMap[parentId];
  return !linked || linked.length === 0;
}

/**
 * Проверяет, есть ли у данного родителя какие-либо связи.
 * Используется для определения: показывать ли промежуточный уровень.
 */
export function hasLinkedChildren(
  linkMap: LinkMap,
  parentId: string | null | undefined,
): boolean {
  if (!parentId) return false;
  const linked = linkMap[parentId];
  return !!linked && linked.length > 0;
}

/**
 * Загружает связи между справочниками для текущего проекта.
 * Цепочка: Место работ → Вид работ, (Место работ + Вид работ) → Уровень, Вид работ → Конструкции
 */
export function useDictLinks() {
  const { project } = useProject();
  const [buildingWorkTypes, setBuildingWorkTypes] = useState<LinkMap>({});
  const [workTypeConstructions, setWorkTypeConstructions] = useState<LinkMap>({});
  const [buildingWorkTypeFloors, setBuildingWorkTypeFloors] = useState<LinkMap>({});
  const [workTypeSets, setWorkTypeSets] = useState<LinkMap>({});
  const [workTypeOverlays, setWorkTypeOverlays] = useState<LinkMap>({});
  const [loading, setLoading] = useState(true);

  const loadLinks = useCallback(async () => {
    if (!project) return;
    setLoading(true);

    const [bwtRes, wtcRes, bwtfRes, wtsRes, wtoRes] = await Promise.all([
      supabase.from("dict_building_work_types").select("building_id, work_type_id"),
      supabase.from("dict_work_type_constructions").select("work_type_id, construction_id"),
      supabase.from("dict_building_work_type_floors").select("building_id, work_type_id, floor_id"),
      supabase.from("dict_work_type_sets").select("work_type_id, set_id"),
      supabase.from("dict_work_type_overlays").select("work_type_id, overlay_id"),
    ]);

    setBuildingWorkTypes(buildLinkMap(bwtRes.data, "building_id", "work_type_id"));
    setWorkTypeConstructions(buildLinkMap(wtcRes.data, "work_type_id", "construction_id"));

    // Составной ключ building:work_type → floors
    const floorMap: LinkMap = {};
    if (bwtfRes.data) {
      for (const row of bwtfRes.data) {
        const key = `${row.building_id}:${row.work_type_id}`;
        if (!floorMap[key]) floorMap[key] = [];
        floorMap[key].push(row.floor_id);
      }
    }
    setBuildingWorkTypeFloors(floorMap);

    setWorkTypeSets(buildLinkMap(wtsRes.data, "work_type_id", "set_id"));
    setWorkTypeOverlays(buildLinkMap(wtoRes.data, "work_type_id", "overlay_id"));
    setLoading(false);
  }, [project]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  return {
    buildingWorkTypes,
    workTypeConstructions,
    buildingWorkTypeFloors,
    workTypeSets,
    workTypeOverlays,
    loading,
    reload: loadLinks,
  };
}
