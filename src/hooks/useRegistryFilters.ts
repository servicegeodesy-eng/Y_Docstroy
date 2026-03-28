import { useEffect, useRef, useState } from "react";
import type { FilterKey } from "@/components/registry/RegistryFilters";

export function useRegistryFilters() {
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filters, setFilters] = useState<Record<FilterKey, Set<string>>>(() => {
    try {
      const raw = sessionStorage.getItem("registry_filters");
      if (raw) {
        const p = JSON.parse(raw);
        return {
          status: new Set(p.status || []), building: new Set(p.building || []),
          floor: new Set(p.floor || []), workType: new Set(p.workType || []),
          construction: new Set(p.construction || []), set: new Set(p.set || []), manualTag: new Set(p.manualTag || []),
        };
      }
    } catch { /* ignore */ }
    return { status: new Set(), building: new Set(), floor: new Set(), workType: new Set(), construction: new Set(), set: new Set(), manualTag: new Set() };
  });
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // Дропдаун форматов файлов
  const [formatDropdown, setFormatDropdown] = useState<{ cellId: string; ext: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const formatBtnRef = useRef<HTMLButtonElement>(null);

  // Предпросмотр файла
  const [previewFile, setPreviewFile] = useState<{ fileName: string; storagePath: string } | null>(null);

  useEffect(() => {
    if (!formatDropdown) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFormatDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [formatDropdown]);

  useEffect(() => {
    if (!openFilter) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (filterRef.current && !filterRef.current.contains(target) &&
          !(target instanceof Element && target.closest("[data-dropdown-portal]"))) {
        setOpenFilter(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openFilter]);

  // Сохранение фильтров в sessionStorage
  useEffect(() => {
    const obj: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(filters)) obj[k] = Array.from(v);
    sessionStorage.setItem("registry_filters", JSON.stringify(obj));
  }, [filters]);

  const activeFilterCount = Object.values(filters).reduce((n, s) => n + s.size, 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || !!search;

  function clearFilters() {
    setFilters({ status: new Set(), building: new Set(), floor: new Set(), workType: new Set(), construction: new Set(), set: new Set(), manualTag: new Set() });
    setDateFrom(""); setDateTo(""); setSearch("");
  }

  function toggleFilterValue(key: FilterKey, value: string) {
    setFilters((prev) => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [key]: next };
    });
  }

  return {
    search, setSearch, showSearch, setShowSearch,
    showFilters, setShowFilters,
    dateFrom, setDateFrom, dateTo, setDateTo,
    filters, setFilters, openFilter, setOpenFilter, filterRef,
    formatDropdown, setFormatDropdown, dropdownRef, formatBtnRef,
    previewFile, setPreviewFile,
    activeFilterCount, hasActiveFilters,
    clearFilters, toggleFilterValue,
  };
}
