"use client";

import { useState } from "react";

import { readableApiError, type AuthUser } from "@/lib/api";

type Mode = "login" | "register";

export function AuthPanel({
                              user,
                              isGuest,
                              login,
                              register,
                              logout,
                          }: {
    user: AuthUser | null;
    isGuest: boolean;
    login: (email: string, password: string) => Promise<unknown>;
    register: (
        email: string,
        password: string,
        displayName?: string,
    ) => Promise<unknown>;
    logout: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<Mode>("login");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const close = () => {
        if (loading) return;

        setOpen(false);
        setError(null);
        setPassword("");
    };

    const submit = async () => {
        if (!email.trim() || !password) {
            setError("Introduce email y contraseña.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (mode === "login") {
                await login(email, password);
            } else {
                await register(
                    email,
                    password,
                    displayName,
                );
            }

            setOpen(false);
            setPassword("");
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

    if (!isGuest && user) {
        return (
            <div className="account-menu">
                <button
                    type="button"
                    className="account-pill"
                    onClick={() => setOpen((current) => !current)}
                    title={user.email}
                >
          <span className="account-avatar">
            {(user.display_name ?? user.email)
                .charAt(0)
                .toUpperCase()}
          </span>

                    <span className="account-copy">
            <strong>
              {user.display_name ?? "Mi cuenta"}
            </strong>
            <span>Sincronizado</span>
          </span>
                </button>

                {open ? (
                    <div className="account-dropdown">
                        <div className="account-dropdown-user">
                            <strong>
                                {user.display_name ?? "Usuario"}
                            </strong>
                            <span>{user.email}</span>
                        </div>

                        <button
                            type="button"
                            className="account-logout"
                            onClick={() => {
                                logout();
                                setOpen(false);
                            }}
                        >
                            Cerrar sesión
                        </button>
                    </div>
                ) : null}
            </div>
        );
    }

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
          <strong>Invitado</strong>
          <small>Guardar mis datos</small>
        </span>
            </button>

            {open ? (
                <div
                    className="auth-modal-backdrop"
                    onMouseDown={close}
                >
                    <div
                        className="auth-modal"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="auth-modal-header">
                            <div>
                                <p className="auth-eyebrow">
                                    Catastro Digital
                                </p>

                                <h2>
                                    {mode === "login"
                                        ? "Iniciar sesión"
                                        : "Guardar mis datos"}
                                </h2>

                                <p>
                                    {mode === "login"
                                        ? "Accede a tus parcelas desde cualquier dispositivo."
                                        : "Crea una cuenta para sincronizar tus parcelas y grupos."}
                                </p>
                            </div>

                            <button
                                type="button"
                                className="auth-close"
                                onClick={close}
                                aria-label="Cerrar"
                            >
                                ×
                            </button>
                        </div>

                        <div className="auth-tabs">
                            <button
                                type="button"
                                className={mode === "login" ? "active" : ""}
                                onClick={() => {
                                    setMode("login");
                                    setError(null);
                                }}
                            >
                                Entrar
                            </button>

                            <button
                                type="button"
                                className={mode === "register" ? "active" : ""}
                                onClick={() => {
                                    setMode("register");
                                    setError(null);
                                }}
                            >
                                Crear cuenta
                            </button>
                        </div>

                        <div className="auth-form">
                            {mode === "register" ? (
                                <label>
                                    <span>Nombre</span>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(event) =>
                                            setDisplayName(event.target.value)
                                        }
                                        placeholder="Tu nombre"
                                        autoComplete="name"
                                    />
                                </label>
                            ) : null}

                            <label>
                                <span>Email</span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                    placeholder="nombre@ejemplo.com"
                                    autoComplete="email"
                                />
                            </label>

                            <label>
                                <span>Contraseña</span>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    placeholder="••••••••"
                                    autoComplete={
                                        mode === "login"
                                            ? "current-password"
                                            : "new-password"
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
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
                                disabled={loading}
                                onClick={() => void submit()}
                            >
                                {loading
                                    ? "Procesando..."
                                    : mode === "login"
                                        ? "Iniciar sesión"
                                        : "Crear cuenta"}
                            </button>

                            <p className="auth-guest-info">
                                Puedes seguir usando Catastro Digital como invitado.
                                Más adelante tus datos locales podrán transferirse
                                a tu cuenta.
                            </p>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}