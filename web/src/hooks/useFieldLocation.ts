"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DeviceLocation } from "@/types/cadastre";

export type FieldLocationStatus = "idle" | "requesting" | "tracking" | "error";

export function useFieldLocation() {
  const watchIdRef = useRef<number | null>(null);
  const [status, setStatus] = useState<FieldLocationStatus>("idle");
  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation?.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setStatus("idle");
    setError(null);
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;

    if (!window.isSecureContext) {
      setStatus("error");
      setError(
        "La ubicación del móvil requiere HTTPS. En el propio PC localhost funciona, pero para usarlo desde el teléfono debes abrir Catastro Digital mediante una dirección HTTPS.",
      );
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Este dispositivo o navegador no ofrece geolocalización.");
      return;
    }

    if (watchIdRef.current !== null) return;

    setStatus("requesting");
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading != null && Number.isFinite(position.coords.heading)
            ? position.coords.heading
            : null,
          speed: position.coords.speed != null && Number.isFinite(position.coords.speed)
            ? position.coords.speed
            : null,
          timestamp: position.timestamp,
        });
        setStatus("tracking");
        setError(null);
      },
      (positionError) => {
        const message =
          positionError.code === positionError.PERMISSION_DENIED
            ? "Permiso de ubicación denegado. Actívalo para este sitio en los ajustes del navegador."
            : positionError.code === positionError.POSITION_UNAVAILABLE
              ? "No se puede determinar tu posición en este momento."
              : "El GPS está tardando demasiado. Muévete a una zona con mejor recepción e inténtalo de nuevo.";
        setStatus("error");
        setError(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 2_000,
      },
    );
  }, []);

  useEffect(() => stop, [stop]);

  return {
    status,
    location,
    error,
    start,
    stop,
  };
}
