import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { isPdf, pdfToImage } from "@/lib/pdfToImage";
import type { Overlay, DictLinkConfig } from "@/types";
import { DICT_LINK_CONFIGS } from "@/types";

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

// Конфиги связей подложки — порядок: Место работ → Вид работ → Уровни/срезы → Конструкция
export const overlayLinkConfigs: DictLinkConfig[] = [
  DICT_LINK_CONFIGS[6], // Подложка → Место работ
  // Подложка → Вид работ (обратная связь через dict_work_type_overlays)
  {
    parentTable: "dict_overlays",
    childTable: "dict_work_types",
    linkTable: "dict_work_type_overlays",
    parentFk: "overlay_id",
    childFk: "work_type_id",
    parentLabel: "Подложка",
    childLabel: "Вид работ",
  },
  DICT_LINK_CONFIGS[7], // Подложка → Уровни/срезы
  DICT_LINK_CONFIGS[8], // Подложка → Конструкция
  DICT_LINK_CONFIGS[9], // Подложка → Работы
];

export const TAB_TYPE_INLINE: Record<string, { borderColor: string; background: string; color: string }> = {
  plan: { borderColor: "color-mix(in srgb, var(--ds-accent) 40%, var(--ds-border))", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)" },
  facades: { borderColor: "color-mix(in srgb, #f97316 40%, var(--ds-border))", background: "color-mix(in srgb, #f97316 10%, var(--ds-surface))", color: "#f97316" },
  landscaping: { borderColor: "color-mix(in srgb, #22c55e 40%, var(--ds-border))", background: "color-mix(in srgb, #22c55e 10%, var(--ds-surface))", color: "#22c55e" },
};

/** Автоопределение типа вкладки по связям:
 *  Уровни + Конструкции → facades
 *  Конструкции (без Уровней) → landscaping
 *  Любые другие связи → plan
 *  Нет связей → null
 */
export function getAutoTabType(
  overlayId: string,
  linked: Record<number, Set<string>>,
): 'plan' | 'facades' | 'landscaping' | null {
  const hasBuilding = linked[0]?.has(overlayId) || false;
  const hasWorkType = linked[1]?.has(overlayId) || false;
  const hasFloor = linked[2]?.has(overlayId) || false;
  const hasConstruction = linked[3]?.has(overlayId) || false;

  if (!hasBuilding && !hasWorkType && !hasFloor && !hasConstruction) return null;

  if (hasFloor && hasConstruction) return 'facades';
  if (hasConstruction) return 'landscaping';
  return 'plan';
}

export function useOverlayAdmin() {
  const { project } = useProject();
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");

  // Для связывания подложки со справочниками
  const [linkingOverlay, setLinkingOverlay] = useState<Overlay | null>(null);
  const [linkingConfig, setLinkingConfig] = useState<DictLinkConfig | null>(null);

  // Корректировка масок после замены подложки
  const [adjustingOverlay, setAdjustingOverlay] = useState<Overlay | null>(null);
  const [adjustOldDims, setAdjustOldDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [deleteMode, setDeleteMode] = useState(false);

  // Сетки осей
  const [overlayAxisGridLinks, setOverlayAxisGridLinks] = useState<{ id: string; overlay_id: string; grid_id: string }[]>([]);
  const [axisLinkingOverlay, setAxisLinkingOverlay] = useState<Overlay | null>(null);

  // Какие подложки имеют установленные связи: linkConfigIndex → Set<overlayId>
  const [linkedOverlayIds, setLinkedOverlayIds] = useState<Record<number, Set<string>>>({});

  useEffect(() => {
    loadOverlays();
    loadAxisGridData();
  }, [project]);

  async function loadOverlays() {
    if (!project) return;
    setLoading(true);
    const { data } = await supabase
      .from("dict_overlays")
      .select("*")
      .eq("project_id", project.id)
      .order("sort_order")
      .order("name");
    if (data) setOverlays(data);
    setLoading(false);
    loadLinkStatus();
  }

  async function loadLinkStatus() {
    const result: Record<number, Set<string>> = {};
    await Promise.all(overlayLinkConfigs.map(async (lc, idx) => {
      const { data } = await supabase
        .from(lc.linkTable)
        .select(lc.parentFk);
      const ids = new Set<string>();
      if (data) {
        for (const row of data) {
          ids.add((row as unknown as Record<string, string>)[lc.parentFk]);
        }
      }
      result[idx] = ids;
    }));
    setLinkedOverlayIds(result);
  }

  async function loadAxisGridData() {
    if (!project) return;
    const { data } = await supabase
      .from("dict_overlay_axis_grids")
      .select("id, overlay_id, grid_id");
    setOverlayAxisGridLinks(data || []);
  }

  async function uploadOverlay() {
    if (!project || !newName.trim() || !selectedFile) return;
    setUploading(true);

    const overlayId = crypto.randomUUID();
    let fileToUpload = selectedFile;
    let dims: { width: number; height: number };

    // PDF → конвертация в PNG
    if (isPdf(selectedFile)) {
      try {
        const result = await pdfToImage(selectedFile);
        fileToUpload = result.file;
        dims = { width: result.width, height: result.height };
      } catch (err) {
        alert("Ошибка конвертации PDF: " + (err instanceof Error ? err.message : err));
        setUploading(false);
        return;
      }
    } else {
      dims = await getImageDimensions(selectedFile);
    }

    const ext = fileToUpload.name.includes(".") ? "." + fileToUpload.name.split(".").pop() : "";
    const storagePath = `${project.id}/${overlayId}${ext}`;

    // Загрузить в storage
    const { error: uploadError } = await supabase.storage
      .from("overlay-images")
      .upload(storagePath, fileToUpload, { upsert: true });

    if (uploadError) {
      alert("Ошибка загрузки: " + uploadError.message);
      setUploading(false);
      return;
    }

    // Создать запись в БД
    const { error: dbError } = await supabase.from("dict_overlays").insert({
      id: overlayId,
      project_id: project.id,
      name: newName.trim(),
      file_name: selectedFile.name,
      storage_path: storagePath,
      width: dims.width,
      height: dims.height,
      sort_order: overlays.length,
    });

    if (dbError) {
      alert("Ошибка: " + dbError.message);
      await supabase.storage.from("overlay-images").remove([storagePath]);
      setUploading(false);
      return;
    }

    setNewName("");
    setSelectedFile(null);
    setUploading(false);
    loadOverlays();
  }

  async function deleteOverlay(overlay: Overlay) {
    // Подсчёт затронутых масок
    const { count: maskCount } = await supabase
      .from("cell_overlay_masks")
      .select("id", { count: "exact", head: true })
      .eq("overlay_id", overlay.id);

    // Подсчёт связей
    let linkCount = 0;
    await Promise.all(overlayLinkConfigs.map(async (lc) => {
      const { count } = await supabase
        .from(lc.linkTable)
        .select("id", { count: "exact", head: true })
        .eq(lc.parentFk, overlay.id);
      linkCount += count || 0;
    }));

    let msg = `Удалить подложку «${overlay.name}»?\n`;
    if ((maskCount || 0) > 0 || linkCount > 0) {
      msg += "\n--- ВНИМАНИЕ! Это действие необратимо ---\n";
      if (maskCount) {
        msg += `\n${maskCount} областей (масок) на ячейках будут удалены`;
      }
      if (linkCount > 0) {
        msg += `\n${linkCount} связей со справочниками будут удалены`;
      }
      msg += "\n\nВосстановить данные после удаления невозможно.";
    }

    if (!confirm(msg)) return;

    await supabase.storage.from("overlay-images").remove([overlay.storage_path]);
    const { error } = await supabase.from("dict_overlays").delete().eq("id", overlay.id);
    if (error) {
      alert("Ошибка удаления: " + error.message);
      return;
    }
    loadOverlays();
  }

  async function saveEdit(overlay: Overlay) {
    if (!editName.trim()) return;
    setSaving(true);

    const updates: Record<string, unknown> = { name: editName.trim() };

    if (editFile) {
      let fileToUpload = editFile;
      let dims: { width: number; height: number };

      if (isPdf(editFile)) {
        try {
          const result = await pdfToImage(editFile);
          fileToUpload = result.file;
          dims = { width: result.width, height: result.height };
        } catch (err) {
          alert("Ошибка конвертации PDF: " + (err instanceof Error ? err.message : err));
          setSaving(false);
          return;
        }
      } else {
        dims = await getImageDimensions(editFile);
      }

      const ext = fileToUpload.name.includes(".") ? "." + fileToUpload.name.split(".").pop() : "";
      const newStoragePath = `${project!.id}/${overlay.id}${ext}`;

      // Удалить старый файл
      await supabase.storage.from("overlay-images").remove([overlay.storage_path]);

      // Загрузить новый
      const { error: uploadError } = await supabase.storage
        .from("overlay-images")
        .upload(newStoragePath, fileToUpload, { upsert: true });

      if (uploadError) {
        alert("Ошибка загрузки файла: " + uploadError.message);
        setSaving(false);
        return;
      }

      updates.file_name = editFile.name;
      updates.storage_path = newStoragePath;
      updates.width = dims.width;
      updates.height = dims.height;
    }

    await supabase.from("dict_overlays").update(updates).eq("id", overlay.id);

    // Если файл заменён — проверить наличие масок для корректировки
    if (editFile) {
      const { count } = await supabase
        .from("cell_overlay_masks")
        .select("id", { count: "exact", head: true })
        .eq("overlay_id", overlay.id);
      if (count && count > 0) {
        setAdjustOldDims({ w: overlay.width || 0, h: overlay.height || 0 });
        // Обновить overlay в памяти с новыми размерами
        const updatedOverlay: Overlay = {
          ...overlay,
          width: updates.width as number ?? overlay.width,
          height: updates.height as number ?? overlay.height,
          storage_path: (updates.storage_path as string) ?? overlay.storage_path,
        };
        setEditingId(null);
        setEditFile(null);
        setSaving(false);
        loadOverlays();
        setAdjustingOverlay(updatedOverlay);
        return;
      }
    }

    setEditingId(null);
    setEditFile(null);
    setSaving(false);
    loadOverlays();
  }

  async function updateTabType(id: string, tabType: string | null) {
    await supabase.from("dict_overlays").update({ tab_type: tabType }).eq("id", id);
    setOverlays((prev) => prev.map((o) => o.id === id ? { ...o, tab_type: tabType as Overlay["tab_type"] } : o));
  }

  async function showPreview(overlay: Overlay) {
    const { data } = await supabase.storage
      .from("overlay-images")
      .createSignedUrl(overlay.storage_path, 300);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewName(overlay.name);
    }
  }

  return {
    // Data
    overlays,
    loading,
    uploading,
    linkedOverlayIds,
    overlayAxisGridLinks,

    // Upload form
    newName,
    setNewName,
    selectedFile,
    setSelectedFile,

    // Edit
    editingId,
    setEditingId,
    editName,
    setEditName,
    editFile,
    setEditFile,
    saving,

    // Preview
    previewUrl,
    setPreviewUrl,
    previewName,
    setPreviewName,

    // Dictionary linking
    linkingOverlay,
    setLinkingOverlay,
    linkingConfig,
    setLinkingConfig,

    // Mask adjustment
    adjustingOverlay,
    setAdjustingOverlay,
    adjustOldDims,
    setAdjustOldDims,

    // Delete mode
    deleteMode,
    setDeleteMode,

    // Axis grids
    axisLinkingOverlay,
    setAxisLinkingOverlay,

    // Actions
    loadOverlays,
    loadLinkStatus,
    loadAxisGridData,
    uploadOverlay,
    deleteOverlay,
    saveEdit,
    updateTabType,
    showPreview,
  };
}

export default useOverlayAdmin;
