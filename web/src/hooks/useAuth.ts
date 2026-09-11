"use client";

import { useCallback, useEffect, useState } from "react";

import {
    cadastreApi,
    clearAuthToken,
    getAuthToken,
    setAuthToken,
    type AuthUser,
} from "@/lib/api";

export type AuthStatus =
    | "loading"
    | "guest"
    | "authenticated";

export function useAuth() {
    const [status, setStatus] = useState<AuthStatus>("loading");
    const [user, setUser] = useState<AuthUser | null>(null);

    useEffect(() => {
        const token = getAuthToken();

        if (!token) {
            setUser(null);
            setStatus("guest");
            return;
        }

        void cadastreApi.auth
            .me()
            .then((currentUser) => {
                setUser(currentUser);
                setStatus("authenticated");
            })
            .catch(() => {
                clearAuthToken();
                setUser(null);
                setStatus("guest");
            });
    }, []);

    const login = useCallback(
        async (email: string, password: string) => {
            const response = await cadastreApi.auth.login(
                email.trim(),
                password,
            );

            setAuthToken(response.access_token);
            setUser(response.user);
            setStatus("authenticated");

            return response.user;
        },
        [],
    );

    const register = useCallback(
        async (
            email: string,
            password: string,
            displayName?: string,
        ) => {
            const response = await cadastreApi.auth.register(
                email.trim(),
                password,
                displayName,
            );

            setAuthToken(response.access_token);
            setUser(response.user);
            setStatus("authenticated");

            return response.user;
        },
        [],
    );

    const logout = useCallback(() => {
        cadastreApi.auth.logout();
        setUser(null);
        setStatus("guest");
    }, []);

    return {
        status,
        user,

        isLoading: status === "loading",
        isGuest: status === "guest",
        isAuthenticated: status === "authenticated",

        login,
        register,
        logout,
    };
}