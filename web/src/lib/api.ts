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
    ParcelUnitsResult,
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

export interface AuthUser {
    id: string;
    email: string;
    display_name: string | null;
    is_active: boolean;
    email_verified: boolean;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
    user: AuthUser;
}

const AUTH_TOKEN_KEY = "catastro.authToken";

export const AUTH_SESSION_EXPIRED_EVENT =
    "catastro:auth-session-expired";

export function getAuthToken(): string | null {
    if (typeof window === "undefined") {
        return null;
    }

    return window.localStorage.getItem(
        AUTH_TOKEN_KEY,
    );
}

export function setAuthToken(
    token: string,
): void {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(
        AUTH_TOKEN_KEY,
        token,
    );
}

export function clearAuthToken(): void {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.removeItem(
        AUTH_TOKEN_KEY,
    );
}


function notifyAuthSessionExpired(): void {
    if (typeof window === "undefined") {
        return;
    }

    clearAuthToken();

    window.dispatchEvent(
        new Event(
            AUTH_SESSION_EXPIRED_EVENT,
        ),
    );
}

function isJwtExpired(
    token: string,
): boolean {
    try {
        const parts = token.split(".");

        if (parts.length !== 3) {
            return false;
        }

        const payloadPart = parts[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        const paddedPayload =
            payloadPart.padEnd(
                Math.ceil(
                    payloadPart.length / 4,
                ) * 4,
                "=",
            );

        const payload = JSON.parse(
            window.atob(paddedPayload),
        ) as {
            exp?: unknown;
        };

        if (
            typeof payload.exp !== "number"
        ) {
            return false;
        }

        /*
         * Small safety margin so that a token which is about to expire is not
         * sent while a request is already in flight.
         */
        const nowSeconds =
            Date.now() / 1000;

        return payload.exp <= nowSeconds + 5;
    } catch {
        /*
         * The backend remains the source of truth. If the token cannot be
         * decoded locally, simply send it and let the API validate it.
         */
        return false;
    }
}

function extractErrorMessage(
    rawBody: string,
    fallback: string,
): string {
    if (!rawBody) {
        return fallback;
    }

    try {
        const body =
            JSON.parse(rawBody) as {
                detail?: unknown;
            };

        if (
            typeof body.detail === "string"
        ) {
            return body.detail;
        }

        if (Array.isArray(body.detail)) {
            const first =
                body.detail[0] as
                    | { msg?: unknown }
                    | undefined;

            if (
                typeof first?.msg === "string"
            ) {
                return first.msg;
            }
        }

        return rawBody;
    } catch {
        return rawBody;
    }
}

async function request<T>(
    path: string,
    init?: RequestInit,
): Promise<T> {
    const controller =
        new AbortController();

    const timeout =
        window.setTimeout(
            () => controller.abort(),
            REQUEST_TIMEOUT_MS,
        );

    const isAuthEntryPoint =
        path === "/auth/login" ||
        path === "/auth/register";

    const storedToken =
        isAuthEntryPoint
            ? null
            : getAuthToken();

    if (
        storedToken &&
        isJwtExpired(storedToken)
    ) {
        notifyAuthSessionExpired();

        window.clearTimeout(timeout);

        throw new ApiError(
            "Tu sesión ha caducado. Has vuelto al modo invitado.",
            401,
        );
    }

    try {
        const response = await fetch(
            `${API_BASE}${path}`,
            {
                ...init,
                headers: {
                    ...(init?.body
                        ? {
                            "Content-Type":
                                "application/json",
                        }
                        : {}),
                    ...(storedToken
                        ? {
                            Authorization:
                                `Bearer ${storedToken}`,
                        }
                        : {}),
                    ...init?.headers,
                },
                signal: controller.signal,
                cache: "no-store",
            },
        );

        if (!response.ok) {
            const rawBody =
                await response.text();

            if (
                response.status === 401 &&
                !isAuthEntryPoint
            ) {
                if (storedToken) {
                    notifyAuthSessionExpired();
                }

                throw new ApiError(
                    storedToken
                        ? "Tu sesión ha caducado. Has vuelto al modo invitado."
                        : "Esta acción requiere iniciar sesión.",
                    401,
                );
            }

            const message =
                extractErrorMessage(
                    rawBody,
                    `HTTP ${response.status}`,
                );

            throw new ApiError(
                message,
                response.status,
            );
        }

        if (response.status === 204) {
            return undefined as T;
        }

        return (
            await response.json()
        ) as T;
    } catch (error) {
        if (
            error instanceof DOMException &&
            error.name === "AbortError"
        ) {
            throw new ApiError(
                "La petición ha tardado demasiado tiempo",
                408,
            );
        }

        if (error instanceof TypeError) {
            throw new ApiError(
                "No se pudo conectar con Catastro Digital. Comprueba tu conexión e inténtalo de nuevo.",
                0,
            );
        }

        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}

export const cadastreApi = {
    auth: {
        login(
            email: string,
            password: string,
        ): Promise<AuthResponse> {
            return request<AuthResponse>(
                "/auth/login",
                {
                    method: "POST",
                    body: JSON.stringify({
                        email,
                        password,
                    }),
                },
            );
        },

        register(
            email: string,
            password: string,
            displayName?: string,
        ): Promise<AuthResponse> {
            return request<AuthResponse>(
                "/auth/register",
                {
                    method: "POST",
                    body: JSON.stringify({
                        email,
                        password,
                        display_name:
                            displayName?.trim() ||
                            null,
                    }),
                },
            );
        },

        me(): Promise<AuthUser> {
            return request<AuthUser>(
                "/users/me",
            );
        },

        logout(): void {
            clearAuthToken();
        },
    },

    backup: {
        export():
            Promise<BackupDocument> {
            return request<BackupDocument>(
                "/backup",
            );
        },

        geojson():
            Promise<Record<string, unknown>> {
            return request<
                Record<string, unknown>
            >(
                "/backup/geojson",
            );
        },

        validate(
            document: BackupDocument,
            mode: ImportMode = "merge",
        ): Promise<BackupImportResult> {
            return request<BackupImportResult>(
                `/backup/import?mode=${encodeURIComponent(mode)}&dry_run=true`,
                {
                    method: "POST",
                    body:
                        JSON.stringify(document),
                },
            );
        },

        import(
            document: BackupDocument,
            mode: ImportMode,
        ): Promise<BackupImportResult> {
            return request<BackupImportResult>(
                `/backup/import?mode=${encodeURIComponent(mode)}`,
                {
                    method: "POST",
                    body:
                        JSON.stringify(document),
                },
            );
        },
    },

    groups: {
        async list():
            Promise<ParcelGroup[]> {
            const data =
                await request<{
                    groups: ParcelGroup[];
                }>(
                    "/groups",
                );

            return data.groups;
        },

        create(
            name: string,
        ): Promise<ParcelGroup> {
            return request<ParcelGroup>(
                "/groups",
                {
                    method: "POST",
                    body:
                        JSON.stringify({
                            name,
                        }),
                },
            );
        },

        update(
            groupId: string,
            update: GroupUpdate,
        ): Promise<{ ok: boolean }> {
            return request<{
                ok: boolean;
            }>(
                `/groups/${encodeURIComponent(groupId)}`,
                {
                    method: "PATCH",
                    body:
                        JSON.stringify(update),
                },
            );
        },

        delete(
            groupId: string,
        ): Promise<{ ok: boolean }> {
            return request<{
                ok: boolean;
            }>(
                `/groups/${encodeURIComponent(groupId)}`,
                {
                    method: "DELETE",
                },
            );
        },
    },

    parcels: {
        fieldPosition(
            longitude: number,
            latitude: number,
            selectedRef?: string | null,
        ): Promise<FieldPositionResult> {
            return request<FieldPositionResult>(
                "/parcels/field-position",
                {
                    method: "POST",
                    body: JSON.stringify({
                        longitude,
                        latitude,
                        selected_ref:
                            selectedRef ?? null,
                    }),
                },
            );
        },

        identify(
            longitude: number,
            latitude: number,
        ): Promise<ParcelIdentification> {
            return request<ParcelIdentification>(
                "/parcels/identify",
                {
                    method: "POST",
                    body: JSON.stringify({
                        longitude,
                        latitude,
                    }),
                },
            );
        },

        previewIdentify(
            longitude: number,
            latitude: number,
        ): Promise<ParcelIdentification> {
            return request<ParcelIdentification>(
                "/parcels/preview-identify",
                {
                    method: "POST",
                    body: JSON.stringify({
                        longitude,
                        latitude,
                    }),
                },
            );
        },

        units(
            cadastralRef: string,
        ): Promise<ParcelUnitsResult> {
            const rc14 = cadastralRef
                .replace(/\s+/g, "")
                .toUpperCase()
                .slice(0, 14);

            return request<ParcelUnitsResult>(
                `/parcels/${encodeURIComponent(rc14)}/units`,
            );
        },

        list(
            includeDeleted = false,
        ): Promise<ParcelFeatureCollection> {
            const query =
                includeDeleted
                    ? "?include_deleted=true"
                    : "";

            return request<ParcelFeatureCollection>(
                `/parcels${query}`,
            );
        },

        async lookup(
            cadastralRef: string,
        ): Promise<ParcelFeature> {
            const data =
                await request<{
                    parcel: ParcelFeature;
                }>(
                    "/parcels/lookup",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            cadastral_ref:
                            cadastralRef,
                        }),
                    },
                );

            return data.parcel;
        },

        update(
            cadastralRef: string,
            update: ParcelUpdate,
        ): Promise<{ ok: boolean }> {
            return request<{
                ok: boolean;
            }>(
                `/parcels/${encodeURIComponent(cadastralRef)}`,
                {
                    method: "PATCH",
                    body:
                        JSON.stringify(update),
                },
            );
        },

        delete(
            cadastralRef: string,
        ): Promise<{ ok: boolean }> {
            return request<{
                ok: boolean;
            }>(
                `/parcels/${encodeURIComponent(cadastralRef)}`,
                {
                    method: "DELETE",
                },
            );
        },

        async preview(
            cadastralRef: string,
        ): Promise<ParcelFeature> {
            const data =
                await request<{
                    parcel: ParcelFeature;
                }>(
                    "/parcels/preview",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            cadastral_ref:
                            cadastralRef,
                        }),
                    },
                );

            return data.parcel;
        },
    },
};

function isCatastroError(
    error: ApiError,
): boolean {
    const message =
        error.message.toLowerCase();

    return (
        message.includes("catastro") ||
        message.includes("wfs") ||
        message.includes("rate-limit") ||
        message.includes("límite horario")
    );
}

export function readableApiError(
    error: unknown,
    fallback: string,
): string {
    if (error instanceof ApiError) {
        if (error.status === 401) {
            return error.message;
        }

        if (
            (
                error.status === 502 ||
                error.status === 503
            ) &&
            isCatastroError(error)
        ) {
            return (
                "Catastro no está disponible temporalmente. " +
                "Tus parcelas guardadas siguen disponibles y puedes seguir usando la aplicación."
            );
        }

        if (error.status === 408) {
            return (
                "La consulta está tardando más de lo esperado. " +
                "Inténtalo de nuevo en unos segundos."
            );
        }

        if (error.status === 0) {
            return error.message;
        }

        return error.message;
    }

    if (
        error instanceof Error &&
        error.message
    ) {
        return error.message;
    }

    return fallback;
}
