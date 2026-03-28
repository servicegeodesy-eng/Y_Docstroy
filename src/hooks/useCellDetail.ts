import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Cell, CellFile } from "@/types";

interface ProfileShort {
  last_name: string;
  first_name: string;
  middle_name: string | null;
}

export interface CellWithDicts extends Cell {
  dict_buildings: { name: string } | null;
  dict_floors: { name: string } | null;
  dict_work_types: { name: string } | null;
  dict_constructions: { name: string } | null;
  dict_sets: { name: string } | null;
  assignee: ProfileShort | null;
  assigner: ProfileShort | null;
  creator_profile: ProfileShort | null;
}

export interface RemarkRow {
  id: string;
  text: string | null;
  created_at: string;
  profiles: { last_name: string; first_name: string; middle_name: string | null } | null;
  cell_comment_files: { id: string; file_name: string; file_size: number; storage_path: string }[];
}

export interface SignatureRow {
  id: string;
  user_id: string;
  status: string;
  comment: string | null;
  signed_at: string | null;
  profiles: { last_name: string; first_name: string; middle_name: string | null } | null;
}

export function useCellDetail(cellId: string) {
  const [cell, setCell] = useState<CellWithDicts | null>(null);
  const [files, setFiles] = useState<CellFile[]>([]);
  const [remarks, setRemarks] = useState<RemarkRow[]>([]);
  const [signatures, setSignatures] = useState<SignatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [supervisionFile, setSupervisionFile] = useState<CellFile | null>(null);
  const [archiveScans, setArchiveScans] = useState<CellFile[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [supervisionCount, setSupervisionCount] = useState(0);

  async function loadCell() {
    const { data } = await supabase
      .from("cells")
      .select(`*, dict_buildings(name), dict_floors(name), dict_work_types(name), dict_constructions(name), dict_sets(name),
        assignee:profiles!assigned_to(last_name, first_name, middle_name),
        assigner:profiles!assigned_by(last_name, first_name, middle_name),
        creator_profile:profiles!created_by(last_name, first_name, middle_name)`)
      .eq("id", cellId)
      .single();
    if (data) {
      setCell(data as CellWithDicts);
    }
    setLoading(false);
    return data as CellWithDicts | null;
  }

  async function loadFiles() {
    const { data } = await supabase.from("cell_files").select("*").eq("cell_id", cellId).order("uploaded_at", { ascending: false });
    if (data) {
      setFiles(data.filter((f: CellFile) => f.category !== "supervision_approval" && f.category !== "archive_scan"));
      const sv = data.find((f: CellFile) => f.category === "supervision_approval") || null;
      setSupervisionFile(sv);
      setArchiveScans(data.filter((f: CellFile) => f.category === "archive_scan"));
    }
  }

  async function loadRemarks() {
    const { data: anHistory } = await supabase
      .from("cell_history")
      .select("user_id, created_at")
      .eq("cell_id", cellId)
      .in("action", ["correction_requested", "correction_required"]);
    const anUserTimes = new Set(
      (anHistory || []).map((h: { user_id: string; created_at: string }) =>
        `${h.user_id}_${Math.floor(new Date(h.created_at).getTime() / 5000)}`
      ),
    );

    const { data } = await supabase
      .from("cell_comments")
      .select(`id, text, created_at, user_id, profiles:user_id(last_name, first_name, middle_name), cell_comment_files(id, file_name, file_size, storage_path)`)
      .eq("cell_id", cellId)
      .order("created_at", { ascending: false });

    if (data) {
      const filtered = data.filter((c: { user_id: string; created_at: string }) => {
        const key = `${c.user_id}_${Math.floor(new Date(c.created_at).getTime() / 5000)}`;
        return !anUserTimes.has(key);
      });
      setRemarks(filtered as unknown as RemarkRow[]);
    }
  }

  async function loadSignatures() {
    const { data } = await supabase
      .from("cell_signatures")
      .select(`id, user_id, status, comment, signed_at, profiles:user_id(last_name, first_name, middle_name)`)
      .eq("cell_id", cellId)
      .order("created_at", { ascending: false });
    if (data) setSignatures(data as unknown as SignatureRow[]);
  }

  async function loadCounters() {
    const [commentRes, supervHistoryRes, supervFileRes] = await Promise.all([
      supabase
        .from("cell_public_comments")
        .select("id", { count: "exact", head: true })
        .eq("cell_id", cellId),
      supabase
        .from("cell_history")
        .select("id", { count: "exact", head: true })
        .eq("cell_id", cellId)
        .in("action", ["sent_to_supervision", "supervision_approved", "correction_requested", "correction_required"]),
      supabase
        .from("cell_files")
        .select("id", { count: "exact", head: true })
        .eq("cell_id", cellId)
        .eq("category", "supervision_approval"),
    ]);
    setCommentCount(commentRes.count || 0);
    setSupervisionCount((supervHistoryRes.count || 0) + (supervFileRes.count ? 1 : 0));
  }

  function reload() {
    Promise.all([loadCell(), loadFiles(), loadRemarks(), loadSignatures(), loadCounters()]);
  }

  useEffect(() => {
    Promise.all([loadCell(), loadFiles(), loadRemarks(), loadSignatures(), loadCounters()]);
  }, [cellId]);

  return {
    cell, setCell, files, remarks, signatures, loading,
    supervisionFile, archiveScans, commentCount, supervisionCount,
    loadCell, loadFiles, loadRemarks, loadSignatures, loadCounters, reload,
  };
}
