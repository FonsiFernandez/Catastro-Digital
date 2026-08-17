"use client";

import { useEffect } from "react";
import { CloseIcon } from "@/components/ui/Icons";
import type { NoticeState } from "@/types/cadastre";

export function Notice({ notice, onClose }: { notice: NoticeState; onClose: () => void }) {
  useEffect(() => {
    if (!notice || notice.type === "error") return;
    const timeout = window.setTimeout(onClose, 3500);
    return () => window.clearTimeout(timeout);
  }, [notice, onClose]);

  if (!notice) return null;

  return (
    <div className={`toast toast-${notice.type}`} role="status">
      <span>{notice.message}</span>
      <button type="button" aria-label="Cerrar aviso" onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}
