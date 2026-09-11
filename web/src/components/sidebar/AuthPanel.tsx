"use client";

import { useState } from "react";

import {
    readableApiError,
    type AuthUser,
} from "@/lib/api";

import type {
    GuestMigrationPreview,
    GuestMigrationResolutions,
} from "@/hooks/useAuth";

type Mode = "login" | "register";

type MigrationResult = {
    migrated: boolean;
    groups: number;
    parcels: number;
};

export function AuthPanel({
                              user,
                              isGuest,
                              hasGuestData,
                              login,
                              register,
                              logout,
                              getGuestMigrationPreview,
                              migrateGuestData,
                              onRefresh,
                          }: {
    user: AuthUser | null;
    isGuest: boolean;
    hasGuestData: boolean;

    login: (
        email: string,
        password: string,
    ) => Promise<unknown>;

    register: (
        email: string,
        password: string,
        displayName?: string,
    ) => Promise<unknown>;

    logout: () => void;

    getGuestMigrationPreview:
        () => Promise<GuestMigrationPreview>;

    migrateGuestData: (
        resolutions?: GuestMigrationResolutions,
    ) => Promise<MigrationResult>;

    onRefresh: () => Promise<unknown>;
}) {
    const [open, setOpen] =
        useState(false);

    const [mode, setMode] =
        useState<Mode>("login");

    const [email, setEmail] =
        useState("");

    const [password, setPassword] =
        useState("");

    const [displayName, setDisplayName] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    /*
     * Guest -> account migration
     */
    const [
        migrationPreview,
        setMigrationPreview,
    ] = useState<GuestMigrationPreview | null>(
        null,
    );

    const [
        migrationResolutions,
        setMigrationResolutions,
    ] = useState<GuestMigrationResolutions>(
        {},
    );

    const [
        migrationLoading,
        setMigrationLoading,
    ] = useState(false);

    const [
        migrationError,
        setMigrationError,
    ] = useState<string | null>(
        null,
    );

    const close = () => {
        if (loading) return;

        setOpen(false);
        setError(null);
        setPassword("");
    };

    const prepareMigration =
        async () => {
            const preview =
                await getGuestMigrationPreview();

            const hasData =
                preview.guestGroups > 0 ||
                preview.guestParcels > 0;

            if (!hasData) {
                return;
            }

            const defaultResolutions:
                GuestMigrationResolutions = {};

            /*
             * Default conflicting groups to the
             * existing account group.
             *
             * The user can explicitly switch to
             * "create a new group".
             */
            for (
                const conflict
                of preview.conflicts
                ) {
                defaultResolutions[
                    conflict.guestGroupId
                    ] = {
                    action: "existing",
                };
            }

            setMigrationResolutions(
                defaultResolutions,
            );

            setMigrationError(null);

            setMigrationPreview(
                preview,
            );
        };

    const submit = async () => {
        if (
            !email.trim() ||
            !password
        ) {
            setError(
                "Introduce email y contraseña.",
            );

            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (mode === "login") {
                await login(
                    email,
                    password,
                );
            } else {
                await register(
                    email,
                    password,
                    displayName,
                );
            }

            setOpen(false);
            setPassword("");

            /*
             * Authentication succeeded.
             *
             * We deliberately check the local
             * database after authentication,
             * because the migration needs access
             * to the account groups.
             */
            await prepareMigration();
        } catch (error) {
            setError(
                readableApiError(
                    error,
                    mode === "login"
                        ? "No se pudo iniciar sesión"
                        : "No se pudo crear la cuenta",
                ),
            );
        } finally {
            setLoading(false);
        }
    };

    const changeConflictAction = (
        guestGroupId: string,
        action: "existing" | "rename",
    ) => {
        setMigrationError(null);

        setMigrationResolutions(
            (current) => ({
                ...current,

                [guestGroupId]:
                    action === "existing"
                        ? {
                            action:
                                "existing",
                        }
                        : {
                            action:
                                "rename",
                            newName: "",
                        },
            }),
        );
    };

    const changeConflictName = (
        guestGroupId: string,
        newName: string,
    ) => {
        setMigrationError(null);

        setMigrationResolutions(
            (current) => ({
                ...current,

                [guestGroupId]: {
                    action: "rename",
                    newName,
                },
            }),
        );
    };

    const executeMigration =
        async () => {
            if (!migrationPreview) {
                return;
            }

            /*
             * Give immediate feedback for blank
             * names before sending anything.
             *
             * Duplicate-name validation is also
             * performed by migrateGuestData(),
             * using the complete account group list.
             */
            for (
                const conflict
                of migrationPreview.conflicts
                ) {
                const resolution =
                    migrationResolutions[
                        conflict.guestGroupId
                        ];

                if (!resolution) {
                    setMigrationError(
                        `Debes resolver el grupo "${conflict.guestGroupName}".`,
                    );

                    return;
                }

                if (
                    resolution.action ===
                    "rename" &&
                    !resolution.newName.trim()
                ) {
                    setMigrationError(
                        `Introduce un nuevo nombre para "${conflict.guestGroupName}".`,
                    );

                    return;
                }
            }
            setMigrationLoading(true);
            setMigrationError(null);

            try {
                await migrateGuestData(
                    migrationResolutions,
                );
                await onRefresh();
                setMigrationPreview(null);
                setMigrationResolutions(
                    {},
                );
            } catch (error) {
                setMigrationError(
                    readableApiError(
                        error,
                        "No se pudieron guardar los datos locales en tu cuenta",
                    ),
                );
            } finally {
                setMigrationLoading(false);
            }
        };

    const skipMigration = () => {
        if (migrationLoading) {
            return;
        }

        /*
         * Important:
         * IndexedDB is NOT cleared.
         *
         * The local data remains available and
         * will reappear when the user logs out.
         */
        setMigrationPreview(null);
        setMigrationResolutions({});
        setMigrationError(null);
    };

    const migrationModal =
        migrationPreview ? (
            <div
                className="auth-modal-backdrop"
                onMouseDown={
                    migrationLoading
                        ? undefined
                        : skipMigration
                }
            >
                <div
                    className="auth-modal migration-modal"
                    onMouseDown={(
                        event,
                    ) =>
                        event.stopPropagation()
                    }
                >
                    <div className="auth-modal-header">
                        <div>
                            <p className="auth-eyebrow">
                                Catastro Digital
                            </p>

                            <h2>
                                Guardar datos
                                locales
                            </h2>

                            <p>
                                Hemos encontrado
                                datos creados como
                                invitado en este
                                dispositivo.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="auth-close"
                            disabled={
                                migrationLoading
                            }
                            onClick={
                                skipMigration
                            }
                            aria-label="Cerrar"
                        >
                            ×
                        </button>
                    </div>

                    <div className="migration-summary">
                        <div>
                            <strong>
                                {
                                    migrationPreview.guestGroups
                                }
                            </strong>
                            <span>
                                {migrationPreview.guestGroups ===
                                1
                                    ? "grupo"
                                    : "grupos"}
                            </span>
                        </div>

                        <div>
                            <strong>
                                {
                                    migrationPreview.guestParcels
                                }
                            </strong>
                            <span>
                                {migrationPreview.guestParcels ===
                                1
                                    ? "parcela"
                                    : "parcelas"}
                            </span>
                        </div>
                    </div>

                    {migrationPreview
                        .conflicts.length >
                    0 ? (
                        <div className="migration-conflicts">
                            <div className="migration-conflict-intro">
                                <strong>
                                    Hay grupos con
                                    el mismo nombre
                                </strong>

                                <p>
                                    Elige qué hacer
                                    con cada uno
                                    antes de
                                    continuar.
                                </p>
                            </div>

                            {migrationPreview.conflicts.map(
                                (
                                    conflict,
                                ) => {
                                    const resolution =
                                        migrationResolutions[
                                            conflict
                                                .guestGroupId
                                            ];

                                    const isExisting =
                                        resolution
                                            ?.action ===
                                        "existing";

                                    const isRename =
                                        resolution
                                            ?.action ===
                                        "rename";

                                    return (
                                        <div
                                            className="migration-conflict"
                                            key={
                                                conflict.guestGroupId
                                            }
                                        >
                                            <div className="migration-conflict-name">
                                                {
                                                    conflict.guestGroupName
                                                }
                                            </div>

                                            <label className="migration-option">
                                                <input
                                                    type="radio"
                                                    name={`migration-${conflict.guestGroupId}`}
                                                    checked={
                                                        isExisting
                                                    }
                                                    disabled={
                                                        migrationLoading
                                                    }
                                                    onChange={() =>
                                                        changeConflictAction(
                                                            conflict.guestGroupId,
                                                            "existing",
                                                        )
                                                    }
                                                />

                                                <span>
                                                    <strong>
                                                        Usar
                                                        el
                                                        grupo
                                                        existente
                                                    </strong>

                                                    <small>
                                                        Las
                                                        parcelas
                                                        se
                                                        añadirán
                                                        a
                                                        “
                                                        {
                                                            conflict.existingGroupName
                                                        }
                                                        ”.
                                                    </small>
                                                </span>
                                            </label>

                                            <label className="migration-option">
                                                <input
                                                    type="radio"
                                                    name={`migration-${conflict.guestGroupId}`}
                                                    checked={
                                                        isRename
                                                    }
                                                    disabled={
                                                        migrationLoading
                                                    }
                                                    onChange={() =>
                                                        changeConflictAction(
                                                            conflict.guestGroupId,
                                                            "rename",
                                                        )
                                                    }
                                                />

                                                <span>
                                                    <strong>
                                                        Crear
                                                        un
                                                        grupo
                                                        nuevo
                                                    </strong>

                                                    <small>
                                                        Conserva
                                                        las
                                                        parcelas
                                                        en
                                                        un
                                                        grupo
                                                        separado.
                                                    </small>
                                                </span>
                                            </label>

                                            {isRename ? (
                                                <input
                                                    className="migration-name-input"
                                                    type="text"
                                                    autoFocus
                                                    value={
                                                        resolution.newName
                                                    }
                                                    disabled={
                                                        migrationLoading
                                                    }
                                                    placeholder="Nuevo nombre del grupo"
                                                    onChange={(
                                                        event,
                                                    ) =>
                                                        changeConflictName(
                                                            conflict.guestGroupId,
                                                            event
                                                                .target
                                                                .value,
                                                        )
                                                    }
                                                />
                                            ) : null}
                                        </div>
                                    );
                                },
                            )}
                        </div>
                    ) : (
                        <div className="migration-no-conflicts">
                            <strong>
                                Todo listo
                            </strong>

                            <p>
                                No hay conflictos
                                con los grupos de
                                tu cuenta. Los
                                datos locales se
                                pueden añadir
                                directamente.
                            </p>
                        </div>
                    )}

                    {migrationError ? (
                        <div className="auth-error">
                            {migrationError}
                        </div>
                    ) : null}

                    <div className="migration-actions">
                        <button
                            type="button"
                            className="small-ghost-button"
                            disabled={
                                migrationLoading
                            }
                            onClick={
                                skipMigration
                            }
                        >
                            Ahora no
                        </button>

                        <button
                            type="button"
                            className="auth-submit"
                            disabled={
                                migrationLoading
                            }
                            onClick={() =>
                                void executeMigration()
                            }
                        >
                            {migrationLoading
                                ? "Guardando..."
                                : "Añadir a mi cuenta"}
                        </button>
                    </div>

                    <p className="migration-safety-note">
                        Los datos locales solo
                        se eliminarán de este
                        dispositivo cuando la
                        importación termine
                        correctamente.
                    </p>
                </div>
            </div>
        ) : null;

    /*
     * Authenticated account menu.
     */
    if (!isGuest && user) {
        return (
            <>
                <div className="account-menu">
                    <button
                        type="button"
                        className="account-pill"
                        onClick={() =>
                            setOpen(
                                (
                                    current,
                                ) =>
                                    !current,
                            )
                        }
                        title={user.email}
                    >
                        <span className="account-avatar">
                            {(
                                user.display_name ??
                                user.email
                            )
                                .charAt(0)
                                .toUpperCase()}
                        </span>

                        <span className="account-copy">
                            <strong>
                                {user.display_name ??
                                    "Mi cuenta"}
                            </strong>

                            <span>
                                {hasGuestData
                                    ? "Datos locales pendientes"
                                    : "Sincronizado"}
                            </span>
                        </span>
                    </button>

                    {open ? (
                        <div className="account-dropdown">
                            <div className="account-dropdown-user">
                                <strong>
                                    {user.display_name ??
                                        "Usuario"}
                                </strong>

                                <span>
                                    {
                                        user.email
                                    }
                                </span>
                            </div>

                            {hasGuestData ? (
                                <button
                                    type="button"
                                    className="account-local-data"
                                    onClick={() => {
                                        setOpen(
                                            false,
                                        );

                                        void prepareMigration();
                                    }}
                                >
                                    Guardar datos
                                    locales
                                </button>
                            ) : null}

                            <button
                                type="button"
                                className="account-logout"
                                onClick={() => {
                                    logout();

                                    setOpen(
                                        false,
                                    );
                                }}
                            >
                                Cerrar sesión
                            </button>
                        </div>
                    ) : null}
                </div>

                {migrationModal}
            </>
        );
    }

    /*
     * Guest account button + authentication modal.
     */
    return (
        <>
            <button
                type="button"
                className="guest-account-button"
                onClick={() => {
                    setMode("login");
                    setOpen(true);
                }}
            >
                <span className="guest-dot" />

                <span>
                    <strong>
                        Invitado
                    </strong>

                    <small>
                        Guardar mis datos
                    </small>
                </span>
            </button>

            {open ? (
                <div
                    className="auth-modal-backdrop"
                    onMouseDown={close}
                >
                    <div
                        className="auth-modal"
                        onMouseDown={(
                            event,
                        ) =>
                            event.stopPropagation()
                        }
                    >
                        <div className="auth-modal-header">
                            <div>
                                <p className="auth-eyebrow">
                                    Catastro Digital
                                </p>

                                <h2>
                                    {mode ===
                                    "login"
                                        ? "Iniciar sesión"
                                        : "Guardar mis datos"}
                                </h2>

                                <p>
                                    {mode ===
                                    "login"
                                        ? "Accede a tus parcelas desde cualquier dispositivo."
                                        : "Crea una cuenta para sincronizar tus parcelas y grupos."}
                                </p>
                            </div>

                            <button
                                type="button"
                                className="auth-close"
                                onClick={
                                    close
                                }
                                aria-label="Cerrar"
                            >
                                ×
                            </button>
                        </div>

                        <div className="auth-tabs">
                            <button
                                type="button"
                                className={
                                    mode ===
                                    "login"
                                        ? "active"
                                        : ""
                                }
                                onClick={() => {
                                    setMode(
                                        "login",
                                    );

                                    setError(
                                        null,
                                    );
                                }}
                            >
                                Entrar
                            </button>

                            <button
                                type="button"
                                className={
                                    mode ===
                                    "register"
                                        ? "active"
                                        : ""
                                }
                                onClick={() => {
                                    setMode(
                                        "register",
                                    );

                                    setError(
                                        null,
                                    );
                                }}
                            >
                                Crear cuenta
                            </button>
                        </div>

                        <div className="auth-form">
                            {mode ===
                            "register" ? (
                                <label>
                                    <span>
                                        Nombre
                                    </span>

                                    <input
                                        type="text"
                                        value={
                                            displayName
                                        }
                                        onChange={(
                                            event,
                                        ) =>
                                            setDisplayName(
                                                event
                                                    .target
                                                    .value,
                                            )
                                        }
                                        placeholder="Tu nombre"
                                        autoComplete="name"
                                    />
                                </label>
                            ) : null}

                            <label>
                                <span>
                                    Email
                                </span>

                                <input
                                    type="email"
                                    value={
                                        email
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setEmail(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="nombre@ejemplo.com"
                                    autoComplete="email"
                                />
                            </label>

                            <label>
                                <span>
                                    Contraseña
                                </span>

                                <input
                                    type="password"
                                    value={
                                        password
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setPassword(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="••••••••"
                                    autoComplete={
                                        mode ===
                                        "login"
                                            ? "current-password"
                                            : "new-password"
                                    }
                                    onKeyDown={(
                                        event,
                                    ) => {
                                        if (
                                            event.key ===
                                            "Enter"
                                        ) {
                                            void submit();
                                        }
                                    }}
                                />
                            </label>

                            {error ? (
                                <div className="auth-error">
                                    {error}
                                </div>
                            ) : null}

                            <button
                                type="button"
                                className="auth-submit"
                                disabled={
                                    loading
                                }
                                onClick={() =>
                                    void submit()
                                }
                            >
                                {loading
                                    ? "Procesando..."
                                    : mode ===
                                    "login"
                                        ? "Iniciar sesión"
                                        : "Crear cuenta"}
                            </button>

                            <p className="auth-guest-info">
                                Puedes seguir
                                usando Catastro
                                Digital como
                                invitado. Tus
                                datos permanecerán
                                guardados en este
                                dispositivo hasta
                                que decidas
                                transferirlos a
                                una cuenta.
                            </p>
                        </div>
                    </div>
                </div>
            ) : null}

            {migrationModal}
        </>
    );
}