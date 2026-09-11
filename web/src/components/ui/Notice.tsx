"use client";

import { useEffect } from "react";

import { CloseIcon } from "@/components/ui/Icons";
import type { NoticeState } from "@/types/cadastre";

export function Notice({
                           notice,
                           onClose,
                       }: {
    notice: NoticeState;
    onClose: () => void;
}) {
    useEffect(() => {
        if (!notice || notice.type === "error") {
            return;
        }

        const timeout =
            window.setTimeout(
                onClose,
                4000,
            );

        return () =>
            window.clearTimeout(timeout);
    }, [notice, onClose]);

    if (!notice) {
        return null;
    }

    const isError =
        notice.type === "error";

    return (
        <div
            className={`toast toast-${notice.type}`}
            role={isError ? "alert" : "status"}
            aria-live={
                isError
                    ? "assertive"
                    : "polite"
            }
            aria-atomic="true"
        >
      <span>
        {notice.message}
      </span>

            <button
                type="button"
                aria-label="Cerrar aviso"
                onClick={onClose}
            >
                <CloseIcon />
            </button>
        </div>
    );
}
