import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";
import { formatSize, getExt, downloadStorage, downloadAsZip, isPreviewable } from "@/lib/utils";
import FilePreviewModal from "@/components/ui/FilePreviewModal";
import { getStatusBadgeClass } from "@/constants/statusColors";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useDictionaries } from "@/hooks/useDictionaries";

interface CellWithFiles {
  id: string;
  name: string;
  status: string;
  dict_buildings: { name: string } | null;
  dict_work_types: { name: string } | null;
  dict_floors: { name: string } | null;
  dict_constructions: { name: string } | null;
  dict_sets: { name: string } | null;
  cell_files: {
    id: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    storage_path: string;
  }[];
}

interface GroCellWithFiles {
  id: string;
  dict_buildings: { name: string } | null;
  dict_floors: { name: string } | null;
  gro_cell_files: {
    id: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    storage_path: string;
  }[];
}

interface TreeNode {
  name: string;
  type: "folder" | "cell" | "file";
  children: TreeNode[];
  // Для файлов
  fileData?: {
    id: string;
    file_name: string;
    file_size: number;
    storage_path: string;
  };
  // Для ячеек
  cellId?: string;
  cellStatus?: string;
}

const LEVEL_LABELS = ["Место работ", "Вид работ", "Уровни и виды", "Конструкции и зоны", "Комплект"];

export default function ExplorerPage() {
  const { project, hasPermission } = useProject();
  const { isMobile } = useMobile();
  const { getColorKey } = useProjectStatuses();
  const { buildings, floors, workTypes, constructions, sets, loadDicts } = useDictionaries();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [previewFile, setPreviewFile] = useState<{ fileName: string; storagePath: string } | null>(null);

  // Карта имя → sort_order из всех справочников
  const sortOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of [...buildings, ...floors, ...workTypes, ...constructions, ...sets]) {
      map.set(item.name, item.sort_order ?? 0);
    }
    return map;
  }, [buildings, floors, workTypes, constructions, sets]);

  const loadData = useCallback(async () => {
    if (!project) return;
    const [cellsRes, groRes] = await Promise.all([
      supabase
        .from("cells")
        .select(`
          id, name, status,
          dict_buildings(name),
          dict_work_types(name),
          dict_floors(name),
          dict_constructions(name),
          dict_sets(name),
          cell_files(id, file_name, file_size, mime_type, storage_path)
        `)
        .eq("project_id", project.id)
        .eq("cell_type", "registry"),
      supabase
        .from("gro_cells")
        .select(`
          id,
          dict_buildings(name),
          dict_floors(name),
          gro_cell_files(id, file_name, file_size, mime_type, storage_path)
        `)
        .eq("project_id", project.id),
    ]);

    const cells = (cellsRes.data || []) as unknown as CellWithFiles[];
    const groCells = (groRes.data || []) as unknown as GroCellWithFiles[];
    setTree(buildTree(cells, groCells, sortOrderMap));
    setLoading(false);
  }, [project, sortOrderMap]);

  useEffect(() => {
    loadDicts();
  }, [loadDicts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function buildTree(cells: CellWithFiles[], groCells: GroCellWithFiles[], orderMap: Map<string, number>): TreeNode[] {
    const root: TreeNode = { name: "root", type: "folder", children: [] };

    for (const cell of cells) {
      const levels: string[] = [];
      if (cell.dict_buildings?.name) levels.push(cell.dict_buildings.name);
      if (cell.dict_work_types?.name) levels.push(cell.dict_work_types.name);
      if (cell.dict_floors?.name) levels.push(cell.dict_floors.name);
      if (cell.dict_constructions?.name) levels.push(cell.dict_constructions.name);
      if (cell.dict_sets?.name) levels.push(cell.dict_sets.name);

      let current = root;
      for (const levelName of levels) {
        let found = current.children.find(
          (c) => c.type === "folder" && c.name === levelName
        );
        if (!found) {
          found = { name: levelName, type: "folder", children: [] };
          current.children.push(found);
        }
        current = found;
      }

      const cellFolder: TreeNode = {
        name: cell.name,
        type: "cell",
        cellId: cell.id,
        cellStatus: cell.status,
        children: cell.cell_files.map((f) => ({
          name: f.file_name,
          type: "file" as const,
          children: [],
          fileData: {
            id: f.id,
            file_name: f.file_name,
            file_size: f.file_size,
            storage_path: f.storage_path,
          },
        })),
      };
      current.children.push(cellFolder);
    }

    // ГРО-ячейки: Место работ → Уровень (если есть) → ГРО → файлы
    for (const gro of groCells) {
      let current = root;

      if (gro.dict_buildings?.name) {
        let found = current.children.find((c) => c.type === "folder" && c.name === gro.dict_buildings!.name);
        if (!found) {
          found = { name: gro.dict_buildings.name, type: "folder", children: [] };
          current.children.push(found);
        }
        current = found;
      }

      if (gro.dict_floors?.name) {
        let found = current.children.find((c) => c.type === "folder" && c.name === gro.dict_floors!.name);
        if (!found) {
          found = { name: gro.dict_floors.name, type: "folder", children: [] };
          current.children.push(found);
        }
        current = found;
      }

      // Папка «ГРО»
      let groFolder = current.children.find((c) => c.type === "folder" && c.name === "ГРО");
      if (!groFolder) {
        groFolder = { name: "ГРО", type: "folder", children: [] };
        current.children.push(groFolder);
      }

      // Файлы ГРО-ячейки — прямо в папку ГРО
      for (const f of gro.gro_cell_files) {
        groFolder.children.push({
          name: f.file_name,
          type: "file",
          children: [],
          fileData: {
            id: f.id,
            file_name: f.file_name,
            file_size: f.file_size,
            storage_path: f.storage_path,
          },
        });
      }
    }

    sortTree(root, orderMap);
    return root.children;
  }

  function sortTree(node: TreeNode, orderMap: Map<string, number>) {
    node.children.sort((a, b) => {
      if (a.type === "file" && b.type !== "file") return 1;
      if (a.type !== "file" && b.type === "file") return -1;
      const orderA = orderMap.get(a.name) ?? Number.MAX_SAFE_INTEGER;
      const orderB = orderMap.get(b.name) ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, "ru");
    });
    for (const child of node.children) {
      if (child.children.length > 0) sortTree(child, orderMap);
    }
  }

  // Навигация по пути
  function getCurrentNodes(): TreeNode[] {
    let nodes = tree;
    for (const segment of path) {
      const found = nodes.find((n) => n.name === segment);
      if (found) {
        nodes = found.children;
      } else {
        return [];
      }
    }
    return nodes;
  }

  function navigate(name: string) {
    setPath((prev) => [...prev, name]);
  }

  function navigateTo(index: number) {
    setPath((prev) => prev.slice(0, index));
  }

  function getLevelLabel(): string {
    if (path.length === 0) return "";
    if (path.length <= LEVEL_LABELS.length) return LEVEL_LABELS[path.length - 1];
    return "Ячейка";
  }

  const currentNodes = getCurrentNodes();
  const filteredNodes = search
    ? currentNodes.filter((n) => n.name.toLowerCase().includes(search.toLowerCase()))
    : currentNodes;

  // Подсчёт вложенных файлов
  function countFiles(node: TreeNode): number {
    if (node.type === "file") return 1;
    return node.children.reduce((sum, c) => sum + countFiles(c), 0);
  }

  // Собрать все файлы из узла рекурсивно (с путями для вложенных папок)
  function collectFiles(node: TreeNode, prefix = ""): { storagePath: string; fileName: string }[] {
    if (node.type === "file" && node.fileData) {
      return [{ storagePath: node.fileData.storage_path, fileName: prefix + node.fileData.file_name }];
    }
    return node.children.flatMap((child) => {
      const childPrefix = child.type === "file" ? prefix : prefix + child.name + "/";
      return collectFiles(child, childPrefix);
    });
  }

  // Общий размер файлов в узле
  function totalSize(node: TreeNode): number {
    if (node.type === "file" && node.fileData) return node.fileData.file_size;
    return node.children.reduce((sum, c) => sum + totalSize(c), 0);
  }

  async function downloadFolder(node: TreeNode) {
    const files = collectFiles(node);
    if (files.length === 0) return;
    const size = totalSize(node);
    const sizeMb = (size / 1048576).toFixed(1);
    if (size > 50 * 1048576) {
      if (!confirm(`Папка «${node.name}» содержит ${files.length} файл(ов), общим объёмом ${sizeMb} МБ.\n\nСкачивание может занять продолжительное время. Продолжить?`)) return;
    }
    await downloadAsZip(files, node.name);
  }

  return (
    <div>
      <div className={`flex items-center justify-between ${isMobile ? "mb-3" : "mb-6"}`}>
        <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>Проводник</h2>
        {getLevelLabel() && !isMobile && (
          <span className="text-sm" style={{ color: "var(--ds-text-faint)" }}>{getLevelLabel()}</span>
        )}
      </div>

      {/* Breadcrumb */}
      <div className={`ds-card ${isMobile ? "p-2 mb-3" : "p-3 mb-4"}`}>
        <div className={`flex items-center gap-1 ${isMobile ? "text-xs" : "text-sm"} flex-wrap`}>
          <button
            onClick={() => navigateTo(0)}
            className="flex items-center gap-1 hover:text-blue-600 font-medium" style={{ color: "var(--ds-text-muted)" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Корень
          </button>
          {path.map((segment, i) => (
            <span key={i} className="flex items-center gap-1">
              <svg className="w-3 h-3" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <button
                onClick={() => navigateTo(i + 1)}
                className="hover:text-blue-600"
                style={{ color: i === path.length - 1 ? "var(--ds-text)" : "var(--ds-text-muted)", fontWeight: i === path.length - 1 ? 500 : undefined }}
              >
                {segment}
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Содержимое */}
      <div className="ds-card">
        {/* Поиск */}
        <div className={`flex items-center ${isMobile ? "px-3 py-2 gap-2" : "px-4 py-3"}`} style={{ borderBottom: "1px solid var(--ds-border)" }}>
          <div className={`relative flex-1 ${isMobile ? "" : "max-w-sm"}`}>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isMobile ? "Поиск..." : "Поиск в текущей папке..."}
              className={`ds-input w-full pl-10 pr-4 py-1.5 ${isMobile ? "text-xs" : "text-sm"}`}
            />
          </div>
          {path.length > 0 && (
            <button
              onClick={() => setPath((prev) => prev.slice(0, -1))}
              className={`ds-btn-secondary ${isMobile ? "p-2" : "ml-3"} flex items-center gap-1`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {!isMobile && "Назад"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="px-4 py-16 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
        ) : filteredNodes.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <svg className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="font-medium mb-1" style={{ color: "var(--ds-text)" }}>
              {tree.length === 0 ? "Нет ячеек" : "Папка пуста"}
            </h3>
            <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>
              {tree.length === 0
                ? "Создайте ячейки в реестре — они автоматически появятся здесь."
                : "В этой папке нет элементов."}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--ds-border)" }}>
            {filteredNodes.map((node, i) => (
              <div
                key={`${node.name}-${i}`}
                className={`flex items-center gap-3 ${isMobile ? "px-3 py-3" : "px-4 py-2.5"} cursor-pointer group`}
                onClick={() => {
                  if (node.type === "file" && node.fileData) {
                    if (isPreviewable(node.fileData.file_name)) {
                      setPreviewFile({ fileName: node.fileData.file_name, storagePath: node.fileData.storage_path });
                    } else if (hasPermission("can_download_files")) {
                      downloadStorage(node.fileData.storage_path, node.fileData.file_name);
                    }
                  } else {
                    navigate(node.name);
                  }
                }}
              >
                {/* Иконка */}
                {node.type === "file" ? (
                  <div className="w-8 h-8 flex items-center justify-center rounded text-xs font-mono" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)" }}>
                    {getExt(node.name)}
                  </div>
                ) : node.type === "cell" ? (
                  <div className="w-8 h-8 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-8 h-8 flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                    </svg>
                  </div>
                )}

                {/* Имя */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm truncate" style={{ color: "var(--ds-text)" }}>{node.name}</span>
                    {node.type === "cell" && node.cellStatus && (
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${getStatusBadgeClass(getColorKey(node.cellStatus))}`}>
                        {node.cellStatus}
                      </span>
                    )}
                  </div>
                  {node.type !== "file" && (
                    <div className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
                      {node.type === "cell"
                        ? `${node.children.length} файл(ов)`
                        : `${countFiles(node)} файл(ов)`}
                    </div>
                  )}
                </div>

                {/* Размер / действие */}
                {node.type === "file" && node.fileData ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatSize(node.fileData.file_size)}</span>
                    {hasPermission("can_download_files") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadStorage(node.fileData!.storage_path, node.fileData!.file_name);
                        }}
                        className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                        style={{ color: "var(--ds-text-faint)" }}
                        title="Скачать"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    {hasPermission("can_download_files") && countFiles(node) > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadFolder(node); }}
                        className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                        style={{ color: "var(--ds-text-faint)" }}
                        title={`Скачать папку (${countFiles(node)} файл(ов))`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    )}
                    <svg className="w-4 h-4 transition-colors" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {previewFile && (
        <FilePreviewModal
          fileName={previewFile.fileName}
          storagePath={previewFile.storagePath}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
