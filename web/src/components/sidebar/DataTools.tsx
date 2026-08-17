"use client";

import { ChangeEvent, useRef, useState } from "react";

import {
  DatabaseIcon,
  DownloadIcon,
  FileCodeIcon,
  UploadIcon,
} from "@/components/ui/Icons";
import { cadastreApi, readableApiError } from "@/lib/api";
import type {
  BackupDocument,
  ImportMode,
  NoticeState,
} from "@/types/cadastre";

const MAX_BACKUP_SIZE = 50 * 1024 * 1024;

function timestampForFilename() {
  const now = new Date();
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
  const time = [now.getHours(), now.getMinutes()]
    .map((part) => String(part).padStart(2, "0"))
    .join("");
  return `${date}_${time}`;
}

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function looksLikeBackup(value: unknown): value is BackupDocument {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BackupDocument>;
  return (
    candidate.format === "catastro-digital-backup" &&
    (candidate.version === 1 || candidate.version === 2) &&
    Array.isArray(candidate.groups) &&
    Array.isArray(candidate.parcels) &&
    typeof candidate.exported_at === "string"
  );
}

export function DataTools({
  onRefresh,
  onNotice,
}: {
  onRefresh: () => Promise<unknown>;
  onNotice: (notice: NoticeState) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<"backup" | "geojson" | "validate" | "import" | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupDocument | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);

  const closeImport = () => {
    setPendingBackup(null);
    setPendingFileName(null);
    setMode("merge");
    setReplaceConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const exportBackup = async () => {
    setBusy("backup");
    try {
      const backup = await cadastreApi.backup.export();
      downloadJson(backup, `catastro-digital-backup_${timestampForFilename()}.json`);
      onNotice({
        type: "success",
        message: `Backup descargado: ${backup.parcels.length} parcelas y ${backup.groups.length} grupos`,
      });
    } catch (error) {
      onNotice({ type: "error", message: readableApiError(error, "No se pudo exportar el backup") });
    } finally {
      setBusy(null);
    }
  };

  const exportGeoJson = async () => {
    setBusy("geojson");
    try {
      const geojson = await cadastreApi.backup.geojson();
      downloadJson(geojson, `catastro-digital_${timestampForFilename()}.geojson`);
      onNotice({ type: "success", message: "GeoJSON exportado correctamente" });
    } catch (error) {
      onNotice({ type: "error", message: readableApiError(error, "No se pudo exportar GeoJSON") });
    } finally {
      setBusy(null);
    }
  };

  const chooseBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BACKUP_SIZE) {
      onNotice({ type: "error", message: "El backup supera el límite de 50 MB" });
      event.target.value = "";
      return;
    }

    setBusy("validate");
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!looksLikeBackup(parsed)) {
        throw new Error("El archivo no es un backup compatible de Catastro Digital (v1/v2)");
      }
      await cadastreApi.backup.validate(parsed);
      setPendingBackup(parsed);
      setPendingFileName(file.name);
      setMode("merge");
      setReplaceConfirmed(false);
    } catch (error) {
      onNotice({ type: "error", message: readableApiError(error, "No se pudo validar el backup") });
      event.target.value = "";
    } finally {
      setBusy(null);
    }
  };

  const importBackup = async () => {
    if (!pendingBackup) return;
    if (mode === "replace" && !replaceConfirmed) return;

    setBusy("import");
    try {
      // Re-validate immediately before the write. The server is the source of truth.
      await cadastreApi.backup.validate(pendingBackup, mode);
      const result = await cadastreApi.backup.import(pendingBackup, mode);
      await onRefresh();
      closeImport();
      onNotice({
        type: "success",
        message: `${mode === "replace" ? "Backup restaurado" : "Backup combinado"}: ${result.parcels} parcelas y ${result.groups} grupos`,
      });
    } catch (error) {
      onNotice({ type: "error", message: readableApiError(error, "No se pudo importar el backup") });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="data-tools">
      <div className="data-tools-heading">
        <div className="control-title data-tools-title">
          <DatabaseIcon />
          <span>Datos y copias</span>
        </div>
        <span className="data-tools-caption">Protege tus parcelas</span>
      </div>

      <div className="data-tools-actions">
        <button
          type="button"
          className="data-tool-button"
          disabled={busy !== null}
          onClick={() => void exportBackup()}
          title="Descargar un backup restaurable con parcelas, geometrías y grupos"
        >
          <DownloadIcon />
          <span>{busy === "backup" ? "Exportando…" : "Backup"}</span>
        </button>

        <button
          type="button"
          className="data-tool-button"
          disabled={busy !== null}
          onClick={() => void exportGeoJson()}
          title="Exportar las parcelas como GeoJSON para usar en aplicaciones GIS"
        >
          <FileCodeIcon />
          <span>{busy === "geojson" ? "Exportando…" : "GeoJSON"}</span>
        </button>

        <button
          type="button"
          className="data-tool-button"
          disabled={busy !== null}
          onClick={() => fileInputRef.current?.click()}
          title="Importar o restaurar un backup de Catastro Digital"
        >
          <UploadIcon />
          <span>{busy === "validate" ? "Validando…" : "Importar"}</span>
        </button>

        <input
          ref={fileInputRef}
          className="visually-hidden-file"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void chooseBackup(event)}
        />
      </div>

      {pendingBackup ? (
        <div className="import-card" role="dialog" aria-label="Importar backup">
          <div className="import-card-header">
            <div>
              <strong>Backup válido</strong>
              <span title={pendingFileName ?? undefined}>{pendingFileName}</span>
            </div>
            <button type="button" className="import-close" onClick={closeImport} aria-label="Cancelar importación">×</button>
          </div>

          <div className="import-summary">
            <div><strong>{pendingBackup.parcels.length}</strong><span>parcelas</span></div>
            <div><strong>{pendingBackup.groups.length}</strong><span>grupos</span></div>
            <div><strong>v{pendingBackup.version}</strong><span>formato</span></div>
          </div>

          <fieldset className="import-mode">
            <legend>Cómo importar</legend>
            <label className={mode === "merge" ? "import-option selected" : "import-option"}>
              <input type="radio" name="import-mode" value="merge" checked={mode === "merge"} onChange={() => { setMode("merge"); setReplaceConfirmed(false); }} />
              <span><strong>Combinar</strong><small>Añade y actualiza; conserva lo que no esté en el backup.</small></span>
            </label>
            <label className={mode === "replace" ? "import-option selected danger-option" : "import-option danger-option"}>
              <input type="radio" name="import-mode" value="replace" checked={mode === "replace"} onChange={() => setMode("replace")} />
              <span><strong>Reemplazar todo</strong><small>Borra los datos actuales y restaura exactamente este backup.</small></span>
            </label>
          </fieldset>

          {mode === "replace" ? (
            <label className="replace-confirmation">
              <input type="checkbox" checked={replaceConfirmed} onChange={(event) => setReplaceConfirmed(event.target.checked)} />
              <span>Entiendo que los datos actuales que no estén en este backup se eliminarán.</span>
            </label>
          ) : null}

          <div className="import-actions">
            <button type="button" className="small-ghost-button" disabled={busy === "import"} onClick={closeImport}>Cancelar</button>
            <button
              type="button"
              className={mode === "replace" ? "small-danger-button" : "small-primary-button"}
              disabled={busy === "import" || (mode === "replace" && !replaceConfirmed)}
              onClick={() => void importBackup()}
            >
              {busy === "import" ? "Importando…" : mode === "replace" ? "Restaurar backup" : "Combinar backup"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
