import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CalibratedAxis } from "@/lib/axisDetection";

/**
 * Загружает калиброванные оси для подложки.
 * Возвращает массив CalibratedAxis для использования в detectAxesForPolygons.
 */
export function useAxisCalibration(overlayId: string | null) {
  const [calibratedAxes, setCalibratedAxes] = useState<CalibratedAxis[]>([]);
  const [axisOrder, setAxisOrder] = useState<'vh' | 'hv'>('vh');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!overlayId) {
      setCalibratedAxes([]);
      return;
    }
    setLoading(true);

    // 1. Получить все связи подложки с сетками
    const { data: links } = await supabase
      .from("dict_overlay_axis_grids")
      .select("id, grid_id")
      .eq("overlay_id", overlayId);

    if (!links || links.length === 0) {
      setCalibratedAxes([]);
      setLoading(false);
      return;
    }

    const overlayGridIds = links.map((l) => l.id);
    const gridIds = links.map((l) => l.grid_id);

    // 2. Получить сетки, оси и калибровочные точки
    const [gridsRes, axesRes, pointsRes] = await Promise.all([
      supabase.from("dict_axis_grids").select("axis_order").in("id", gridIds),
      supabase.from("dict_axis_grid_axes").select("*").in("grid_id", gridIds).order("sort_order"),
      supabase.from("overlay_axis_points").select("*").in("overlay_grid_id", overlayGridIds),
    ]);

    // Порядок из первой сетки
    const order = (gridsRes.data?.[0] as any)?.axis_order;
    if (order === 'hv' || order === 'vh') setAxisOrder(order);

    const axesList = axesRes.data || [];
    const pointsList = pointsRes.data || [];

    const pointsByAxis = new Map<string, typeof pointsList[0]>();
    for (const p of pointsList) {
      pointsByAxis.set(p.axis_id, p);
    }

    const result: CalibratedAxis[] = [];
    for (const axis of axesList) {
      const pts = pointsByAxis.get(axis.id);
      result.push({
        name: axis.name,
        direction: axis.direction,
        sort_order: axis.sort_order,
        p1: pts ? { x: pts.point1_x, y: pts.point1_y } : null,
        p2: pts ? { x: pts.point2_x, y: pts.point2_y } : null,
      });
    }

    setCalibratedAxes(result);
    setLoading(false);
  }, [overlayId]);

  useEffect(() => {
    load();
  }, [load]);

  return { calibratedAxes, axisOrder, loading, reload: load };
}
