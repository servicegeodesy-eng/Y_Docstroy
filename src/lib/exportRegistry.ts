import * as XLSX from "xlsx";
import { supabase } from "./supabase";
import { shortName, formatDate } from "./utils";
import type { ProfileShort } from "./utils";

interface ExportCell {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress_percent: number | null;
  tag: string | null;
  manual_tag: string | null;
  created_at: string;
  created_by: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  dict_buildings: { name: string } | null;
  dict_floors: { name: string } | null;
  dict_work_types: { name: string } | null;
  dict_constructions: { name: string } | null;
  dict_sets: { name: string } | null;
  creator: ProfileShort | null;
  assignee: ProfileShort | null;
  assigner: ProfileShort | null;
  cell_files: { id: string; file_name: string; category: string }[];
  cell_signatures: { status: string; comment: string | null; signed_at: string | null; profiles: ProfileShort | null }[];
  cell_comments: { text: string | null; created_at: string; profiles: ProfileShort | null }[];
  public_comments: { text: string; created_at: string; profiles: ProfileShort | null }[];
}

export interface ExportColumnDef {
  key: string;
  label: string;
  width: number;
  getValue: (cell: ExportCell) => string | number | null;
}

function buildColumnDefs(): ExportColumnDef[] {
  return [
    { key: "name", label: "Наименование", width: 30, getValue: (c) => c.name },
    { key: "status", label: "Статус", width: 20, getValue: (c) => c.status },
    { key: "progress", label: "Прогресс, %", width: 10, getValue: (c) => c.progress_percent },
    { key: "building", label: "Здание", width: 18, getValue: (c) => c.dict_buildings?.name || "" },
    { key: "floor", label: "Этаж", width: 12, getValue: (c) => c.dict_floors?.name || "" },
    { key: "workType", label: "Вид работ", width: 20, getValue: (c) => c.dict_work_types?.name || "" },
    { key: "construction", label: "Конструкция", width: 18, getValue: (c) => c.dict_constructions?.name || "" },
    { key: "set", label: "Комплект", width: 14, getValue: (c) => c.dict_sets?.name || "" },
    { key: "description", label: "Описание", width: 30, getValue: (c) => c.description || "" },
    { key: "tag", label: "Метка", width: 14, getValue: (c) => c.manual_tag || c.tag || "" },
    { key: "createdAt", label: "Дата создания", width: 14, getValue: (c) => formatDate(c.created_at) },
    { key: "creator", label: "Создал", width: 20, getValue: (c) => shortName(c.creator) },
    { key: "assignee", label: "Назначено", width: 20, getValue: (c) => shortName(c.assignee) },
    { key: "assigner", label: "Отправил", width: 20, getValue: (c) => shortName(c.assigner) },
    {
      key: "filesCount", label: "Файлы (кол-во)", width: 10,
      getValue: (c) => c.cell_files.filter((f) => f.category === "general" || !f.category).length,
    },
    {
      key: "filesList", label: "Файлы (список)", width: 30,
      getValue: (c) => c.cell_files.filter((f) => f.category === "general" || !f.category).map((f) => f.file_name).join("\n"),
    },
    {
      key: "supervisionCount", label: "Согласование АН (кол-во)", width: 10,
      getValue: (c) => c.cell_files.filter((f) => f.category === "supervision_approval").length,
    },
    {
      key: "supervisionList", label: "Согласование АН (список)", width: 30,
      getValue: (c) => c.cell_files.filter((f) => f.category === "supervision_approval").map((f) => f.file_name).join("\n"),
    },
    {
      key: "scansCount", label: "Сканы (кол-во)", width: 10,
      getValue: (c) => c.cell_files.filter((f) => f.category === "archive_scan").length,
    },
    {
      key: "scansList", label: "Сканы (список)", width: 30,
      getValue: (c) => c.cell_files.filter((f) => f.category === "archive_scan").map((f) => f.file_name).join("\n"),
    },
    {
      key: "signatures", label: "Подписи", width: 40,
      getValue: (c) => c.cell_signatures.map((s) => {
        const who = shortName(s.profiles);
        const date = s.signed_at ? formatDate(s.signed_at) : "";
        const comment = s.comment ? ` — ${s.comment}` : "";
        return `${s.status}: ${who} ${date}${comment}`;
      }).join("\n"),
    },
    {
      key: "remarks", label: "Замечания", width: 40,
      getValue: (c) => c.cell_comments.map((cm) => {
        const who = shortName(cm.profiles);
        const date = formatDate(cm.created_at);
        return `${who} (${date}): ${cm.text || "(файл)"}`;
      }).join("\n"),
    },
    {
      key: "comments", label: "Комментарии", width: 40,
      getValue: (c) => c.public_comments.map((cm) => {
        const who = shortName(cm.profiles);
        const date = formatDate(cm.created_at);
        return `${who} (${date}): ${cm.text}`;
      }).join("\n"),
    },
  ];
}

export const ALL_EXPORT_COLUMNS = buildColumnDefs();

export async function exportRegistryToXls(projectId: string, projectName: string, selectedKeys: Set<string>) {
  const { data: cells, error } = await supabase
    .from("cells")
    .select(`
      id, name, description, status, progress_percent, tag, manual_tag,
      created_at, created_by, assigned_to, assigned_by,
      dict_buildings(name),
      dict_floors(name),
      dict_work_types(name),
      dict_constructions(name),
      dict_sets(name),
      cell_files(id, file_name, category),
      cell_signatures(status, comment, signed_at, profiles:user_id(last_name, first_name, middle_name)),
      cell_comments(text, created_at, profiles:user_id(last_name, first_name, middle_name)),
      public_comments:cell_public_comments(text, created_at, profiles:user_id(last_name, first_name, middle_name)),
      creator:profiles!created_by(last_name, first_name, middle_name),
      assignee:profiles!assigned_to(last_name, first_name, middle_name),
      assigner:profiles!assigned_by(last_name, first_name, middle_name)
    `)
    .eq("project_id", projectId)
    .eq("cell_type", "registry")
    .order("created_at", { ascending: false });

  if (error || !cells) {
    throw new Error("Не удалось загрузить данные реестра");
  }

  const columns = ALL_EXPORT_COLUMNS.filter((col) => selectedKeys.has(col.key));

  const rows = (cells as unknown as ExportCell[]).map((cell) => {
    const row: Record<string, string | number | null> = {};
    for (const col of columns) {
      row[col.label] = col.getValue(cell);
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = columns.map((col) => ({ wch: col.width }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Реестр");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Реестр_${projectName}_${date}.xlsx`);
}
