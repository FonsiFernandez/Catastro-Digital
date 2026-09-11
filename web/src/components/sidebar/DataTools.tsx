"use client";

import { ChangeEvent, useRef, useState } from "react";

import {
  DatabaseIcon,
  DownloadIcon,
  FileCodeIcon,
  UploadIcon,
} from "@/components/ui/Icons";
import { cadastreApi, readableApiError } from "@/lib/api";
import { guestDb } from "@/lib/guestDb";
import type {
  BackupDocument,
  ImportMode,
  NoticeState,
  ParcelFeature,
} from "@/types/cadastre";

const MAX_BACKUP_SIZE = 50 * 1024 * 1024;

function timestampForFilename() {
  const now = new Date();

  const date = [
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
  ]
      .map((part) => String(part).padStart(2, "0"))
      .join("-");

  const time = [
    now.getHours(),
    now.getMinutes(),
  ]
      .map((part) => String(part).padStart(2, "0"))
      .join("");

  return `${date}_${time}`;
}

function downloadJson(
    value: unknown,
    filename: string,
) {
  const blob = new Blob(
      [JSON.stringify(value, null, 2)],
      {
        type: "application/json;charset=utf-8",
      },
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function looksLikeBackup(
    value: unknown,
): value is BackupDocument {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate =
      value as Partial<BackupDocument>;

  return (
      candidate.format ===
      "catastro-digital-backup" &&
      (
          candidate.version === 1 ||
          candidate.version === 2 ||
          candidate.version === 3
      ) &&
      Array.isArray(candidate.groups) &&
      Array.isArray(candidate.parcels) &&
      typeof candidate.exported_at === "string"
  );
}

function validateLocalBackup(
    backup: BackupDocument,
) {
  const groupIds =
      backup.groups.map((group) => group.id);

  if (
      new Set(groupIds).size !==
      groupIds.length
  ) {
    throw new Error(
        "El backup contiene grupos duplicados.",
    );
  }

  const parcelRefs =
      backup.parcels.map(
          (parcel) =>
              parcel.cadastral_ref
                  .replace(/\s+/g, "")
                  .toUpperCase(),
      );

  if (
      new Set(parcelRefs).size !==
      parcelRefs.length
  ) {
    throw new Error(
        "El backup contiene referencias catastrales duplicadas.",
    );
  }

  const knownGroups =
      new Set(groupIds);

  for (const parcel of backup.parcels) {
    if (
        parcel.group_id &&
        !knownGroups.has(parcel.group_id)
    ) {
      throw new Error(
          `La parcela ${parcel.cadastral_ref} apunta a un grupo no incluido en el backup.`,
      );
    }

    const geometry =
        parcel.geometry as {
          type?: string;
          coordinates?: unknown;
        };

    if (
        geometry.type !== "Polygon" &&
        geometry.type !== "MultiPolygon"
    ) {
      throw new Error(
          `Geometría no compatible en ${parcel.cadastral_ref}.`,
      );
    }

    if (!Array.isArray(geometry.coordinates)) {
      throw new Error(
          `Geometría inválida en ${parcel.cadastral_ref}.`,
      );
    }
  }
}

async function exportGuestGeoJson() {
  const [
    parcels,
    groups,
  ] = await Promise.all([
    guestDb.listParcels(true),
    guestDb.listGroups(),
  ]);

  const groupNames =
      new Map(
          groups.map(
              (group) => [
                group.id,
                group.name,
              ],
          ),
      );

  return {
    type: "FeatureCollection" as const,
    features: parcels.map(
        (parcel) => ({
          type: "Feature" as const,
          geometry: parcel.geometry,
          properties: {
            ...parcel.properties,
            group_name:
                parcel.properties.group_id
                    ? groupNames.get(
                    parcel.properties.group_id,
                ) ?? null
                    : null,
          },
        }),
    ),
  };
}

async function importGuestBackup(
    backup: BackupDocument,
    mode: ImportMode,
) {
  validateLocalBackup(backup);

  if (mode === "replace") {
    await guestDb.clear();
  }

  const currentGroups =
      mode === "replace"
          ? []
          : await guestDb.listGroups();

  const groupIdMap =
      new Map<string, string>();

  for (const backupGroup of backup.groups) {
    const existingById =
        currentGroups.find(
            (group) =>
                group.id === backupGroup.id,
        );

    if (existingById) {
      await guestDb.updateGroup(
          existingById.id,
          {
            name: backupGroup.name,
            is_hidden:
            backupGroup.is_hidden,
          },
      );

      groupIdMap.set(
          backupGroup.id,
          existingById.id,
      );

      continue;
    }

    const created =
        await guestDb.createGroup(
            backupGroup.name,
        );

    if (backupGroup.is_hidden) {
      await guestDb.updateGroup(
          created.id,
          {
            is_hidden: true,
          },
      );
    }

    groupIdMap.set(
        backupGroup.id,
        created.id,
    );
  }

  for (const backupParcel of backup.parcels) {
    const parcel: ParcelFeature = {
      type: "Feature",
      geometry:
          backupParcel.geometry as ParcelFeature["geometry"],
      properties: {
        cadastral_ref:
        backupParcel.cadastral_ref,
        name:
            backupParcel.name ?? null,
        notes:
            backupParcel.notes ?? null,
        color:
        backupParcel.color,
        group_id:
            backupParcel.group_id
                ? groupIdMap.get(
                backupParcel.group_id,
            ) ?? null
                : null,
        is_deleted:
        backupParcel.is_deleted,
        area_m2:
            null,
        area_ha:
            null,
        perimeter_m:
            null,
        source:
            "guest_backup",
      },
    };

    await guestDb.saveParcel(parcel);
  }

  return {
    groups: backup.groups.length,
    parcels: backup.parcels.length,
  };
}

export function DataTools({
                            isGuest,
                            onRefresh,
                            onNotice,
                          }: {
  isGuest: boolean;
  onRefresh: () => Promise<unknown>;
  onNotice: (
      notice: NoticeState,
  ) => void;
}) {
  const fileInputRef =
      useRef<HTMLInputElement | null>(
          null,
      );

  const [
    busy,
    setBusy,
  ] = useState<
      | "backup"
      | "geojson"
      | "validate"
      | "import"
      | null
  >(null);

  const [
    pendingFileName,
    setPendingFileName,
  ] = useState<string | null>(
      null,
  );

  const [
    pendingBackup,
    setPendingBackup,
  ] = useState<BackupDocument | null>(
      null,
  );

  const [
    mode,
    setMode,
  ] = useState<ImportMode>(
      "merge",
  );

  const [
    replaceConfirmed,
    setReplaceConfirmed,
  ] = useState(false);

  const closeImport = () => {
    setPendingBackup(null);
    setPendingFileName(null);
    setMode("merge");
    setReplaceConfirmed(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const exportBackup = async () => {
    setBusy("backup");

    try {
      const backup =
          isGuest
              ? await guestDb.exportBackup()
              : await cadastreApi.backup.export();

      downloadJson(
          backup,
          `catastro-digital-backup_${timestampForFilename()}.json`,
      );

      onNotice({
        type: "success",
        message:
            `Backup descargado: ${backup.parcels.length} parcelas y ${backup.groups.length} grupos`,
      });
    } catch (error) {
      onNotice({
        type: "error",
        message: readableApiError(
            error,
            "No se pudo exportar el backup",
        ),
      });
    } finally {
      setBusy(null);
    }
  };

  const exportGeoJson = async () => {
    setBusy("geojson");

    try {
      const geojson =
          isGuest
              ? await exportGuestGeoJson()
              : await cadastreApi.backup.geojson();

      downloadJson(
          geojson,
          `catastro-digital_${timestampForFilename()}.geojson`,
      );

      onNotice({
        type: "success",
        message:
            "GeoJSON exportado correctamente",
      });
    } catch (error) {
      onNotice({
        type: "error",
        message: readableApiError(
            error,
            "No se pudo exportar GeoJSON",
        ),
      });
    } finally {
      setBusy(null);
    }
  };

  const chooseBackup = async (
      event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
        event.target.files?.[0];

    if (!file) return;

    if (
        file.size >
        MAX_BACKUP_SIZE
    ) {
      onNotice({
        type: "error",
        message:
            "El backup supera el límite de 50 MB",
      });

      event.target.value = "";
      return;
    }

    setBusy("validate");

    try {
      const parsed =
          JSON.parse(
              await file.text(),
          ) as unknown;

      if (!looksLikeBackup(parsed)) {
        throw new Error(
            "El archivo no es un backup compatible de Catastro Digital (v1/v2/v3)",
        );
      }

      if (isGuest) {
        validateLocalBackup(parsed);
      } else {
        await cadastreApi.backup.validate(
            parsed,
        );
      }

      setPendingBackup(parsed);
      setPendingFileName(file.name);
      setMode("merge");
      setReplaceConfirmed(false);
    } catch (error) {
      onNotice({
        type: "error",
        message: readableApiError(
            error,
            "No se pudo validar el backup",
        ),
      });

      event.target.value = "";
    } finally {
      setBusy(null);
    }
  };

  const importBackup = async () => {
    if (!pendingBackup) return;

    if (
        mode === "replace" &&
        !replaceConfirmed
    ) {
      return;
    }

    setBusy("import");

    try {
      let result: {
        groups: number;
        parcels: number;
      };

      if (isGuest) {
        result =
            await importGuestBackup(
                pendingBackup,
                mode,
            );
      } else {
        await cadastreApi.backup.validate(
            pendingBackup,
            mode,
        );

        result =
            await cadastreApi.backup.import(
                pendingBackup,
                mode,
            );
      }

      await onRefresh();

      closeImport();

      onNotice({
        type: "success",
        message:
            `${mode === "replace"
                ? "Backup restaurado"
                : "Backup combinado"}: ${result.parcels} parcelas y ${result.groups} grupos`,
      });
    } catch (error) {
      onNotice({
        type: "error",
        message: readableApiError(
            error,
            "No se pudo importar el backup",
        ),
      });
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

          <span className="data-tools-caption">
          {isGuest
              ? "Datos guardados en este dispositivo"
              : "Protege tus parcelas"}
        </span>
        </div>

        <div className="data-tools-actions">
          <button
              type="button"
              className="data-tool-button"
              disabled={busy !== null}
              onClick={() =>
                  void exportBackup()
              }
              title={
                isGuest
                    ? "Descargar una copia de los datos locales de este dispositivo"
                    : "Descargar un backup restaurable con parcelas, geometrías y grupos"
              }
          >
            <DownloadIcon />
            <span>
            {busy === "backup"
                ? "Exportando…"
                : "Backup"}
          </span>
          </button>

          <button
              type="button"
              className="data-tool-button"
              disabled={busy !== null}
              onClick={() =>
                  void exportGeoJson()
              }
              title="Exportar las parcelas como GeoJSON para usar en aplicaciones GIS"
          >
            <FileCodeIcon />
            <span>
            {busy === "geojson"
                ? "Exportando…"
                : "GeoJSON"}
          </span>
          </button>

          <button
              type="button"
              className="data-tool-button"
              disabled={busy !== null}
              onClick={() =>
                  fileInputRef.current?.click()
              }
              title="Importar o restaurar un backup de Catastro Digital"
          >
            <UploadIcon />
            <span>
            {busy === "validate"
                ? "Validando…"
                : "Importar"}
          </span>
          </button>

          <input
              ref={fileInputRef}
              className="visually-hidden-file"
              type="file"
              accept="application/json,.json"
              onChange={(event) =>
                  void chooseBackup(event)
              }
          />
        </div>

        {pendingBackup ? (
            <div
                className="import-card"
                role="dialog"
                aria-label="Importar backup"
            >
              <div className="import-card-header">
                <div>
                  <strong>
                    Backup válido
                  </strong>

                  <span
                      title={
                          pendingFileName ??
                          undefined
                      }
                  >
                {pendingFileName}
              </span>
                </div>

                <button
                    type="button"
                    className="import-close"
                    onClick={closeImport}
                    aria-label="Cancelar importación"
                >
                  ×
                </button>
              </div>

              <div className="import-summary">
                <div>
                  <strong>
                    {pendingBackup.parcels.length}
                  </strong>
                  <span>parcelas</span>
                </div>

                <div>
                  <strong>
                    {pendingBackup.groups.length}
                  </strong>
                  <span>grupos</span>
                </div>

                <div>
                  <strong>
                    v{pendingBackup.version}
                  </strong>
                  <span>formato</span>
                </div>
              </div>

              <fieldset className="import-mode">
                <legend>
                  Cómo importar
                </legend>

                <label
                    className={
                      mode === "merge"
                          ? "import-option selected"
                          : "import-option"
                    }
                >
                  <input
                      type="radio"
                      name="import-mode"
                      value="merge"
                      checked={
                          mode === "merge"
                      }
                      onChange={() => {
                        setMode("merge");
                        setReplaceConfirmed(
                            false,
                        );
                      }}
                  />

                  <span>
                <strong>
                  Combinar
                </strong>

                <small>
                  Añade y actualiza; conserva lo que no esté en el backup.
                </small>
              </span>
                </label>

                <label
                    className={
                      mode === "replace"
                          ? "import-option selected danger-option"
                          : "import-option danger-option"
                    }
                >
                  <input
                      type="radio"
                      name="import-mode"
                      value="replace"
                      checked={
                          mode === "replace"
                      }
                      onChange={() =>
                          setMode("replace")
                      }
                  />

                  <span>
                <strong>
                  Reemplazar todo
                </strong>

                <small>
                  Borra los datos actuales y restaura el contenido de este backup.
                </small>
              </span>
                </label>
              </fieldset>

              {mode === "replace" ? (
                  <label className="replace-confirmation">
                    <input
                        type="checkbox"
                        checked={
                          replaceConfirmed
                        }
                        onChange={(event) =>
                            setReplaceConfirmed(
                                event.target.checked,
                            )
                        }
                    />

                    <span>
                Entiendo que los datos actuales que no estén en este backup se eliminarán.
              </span>
                  </label>
              ) : null}

              <div className="import-actions">
                <button
                    type="button"
                    className="small-ghost-button"
                    disabled={
                        busy === "import"
                    }
                    onClick={closeImport}
                >
                  Cancelar
                </button>

                <button
                    type="button"
                    className={
                      mode === "replace"
                          ? "small-danger-button"
                          : "small-primary-button"
                    }
                    disabled={
                        busy === "import" ||
                        (
                            mode === "replace" &&
                            !replaceConfirmed
                        )
                    }
                    onClick={() =>
                        void importBackup()
                    }
                >
                  {busy === "import"
                      ? "Importando…"
                      : mode === "replace"
                          ? "Restaurar backup"
                          : "Combinar backup"}
                </button>
              </div>
            </div>
        ) : null}
      </section>
  );
}
