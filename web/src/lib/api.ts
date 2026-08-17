import type {
  BackupDocument,
  BackupImportResult,
  GroupUpdate,
  FieldPositionResult,
  ImportMode,
  ParcelFeature,
  ParcelFeatureCollection,
  ParcelIdentification,
  ParcelGroup,
  ParcelUpdate,
} from "@/types/cadastre";

const API_BASE = "/api";
const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      const rawBody = await response.text();
      if (rawBody) {
        try {
          const body = JSON.parse(rawBody) as { detail?: unknown };
          if (typeof body.detail === "string") {
            message = body.detail;
          } else if (Array.isArray(body.detail)) {
            const first = body.detail[0] as { msg?: unknown } | undefined;
            message = typeof first?.msg === "string" ? first.msg : rawBody;
          } else {
            message = rawBody;
          }
        } catch {
          message = rawBody;
        }
      }
      throw new ApiError(message, response.status);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("La petición ha tardado demasiado tiempo", 408);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export const cadastreApi = {

  backup: {
    export(): Promise<BackupDocument> {
      return request<BackupDocument>("/backup");
    },
    geojson(): Promise<Record<string, unknown>> {
      return request<Record<string, unknown>>("/backup/geojson");
    },
    validate(document: BackupDocument, mode: ImportMode = "merge"): Promise<BackupImportResult> {
      return request<BackupImportResult>(
        `/backup/import?mode=${encodeURIComponent(mode)}&dry_run=true`,
        { method: "POST", body: JSON.stringify(document) },
      );
    },
    import(document: BackupDocument, mode: ImportMode): Promise<BackupImportResult> {
      return request<BackupImportResult>(
        `/backup/import?mode=${encodeURIComponent(mode)}`,
        { method: "POST", body: JSON.stringify(document) },
      );
    },
  },
  groups: {
    async list(): Promise<ParcelGroup[]> {
      const data = await request<{ groups: ParcelGroup[] }>("/groups");
      return data.groups;
    },
    create(name: string): Promise<ParcelGroup> {
      return request<ParcelGroup>("/groups", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
    },
    update(groupId: string, update: GroupUpdate): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>(`/groups/${encodeURIComponent(groupId)}`, {
        method: "PATCH",
        body: JSON.stringify(update),
      });
    },
    delete(groupId: string): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>(`/groups/${encodeURIComponent(groupId)}`, {
        method: "DELETE",
      });
    },
  },
  parcels: {
    fieldPosition(longitude: number, latitude: number, selectedRef?: string | null): Promise<FieldPositionResult> {
      return request<FieldPositionResult>("/parcels/field-position", {
        method: "POST",
        body: JSON.stringify({
          longitude,
          latitude,
          selected_ref: selectedRef ?? null,
        }),
      });
    },
    identify(longitude: number, latitude: number): Promise<ParcelIdentification> {
      return request<ParcelIdentification>("/parcels/identify", {
        method: "POST",
        body: JSON.stringify({ longitude, latitude }),
      });
    },
    list(includeDeleted = false): Promise<ParcelFeatureCollection> {
      const query = includeDeleted ? "?include_deleted=true" : "";
      return request<ParcelFeatureCollection>(`/parcels${query}`);
    },
    async lookup(cadastralRef: string): Promise<ParcelFeature> {
      const data = await request<{ parcel: ParcelFeature }>("/parcels/lookup", {
        method: "POST",
        body: JSON.stringify({ cadastral_ref: cadastralRef }),
      });
      return data.parcel;
    },
    update(cadastralRef: string, update: ParcelUpdate): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>(
        `/parcels/${encodeURIComponent(cadastralRef)}`,
        {
          method: "PATCH",
          body: JSON.stringify(update),
        },
      );
    },
    delete(cadastralRef: string): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>(
        `/parcels/${encodeURIComponent(cadastralRef)}`,
        { method: "DELETE" },
      );
    },
  },
};

export function readableApiError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
