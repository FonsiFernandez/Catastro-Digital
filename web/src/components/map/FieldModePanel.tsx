"use client";

import { useEffect, useRef, useState } from "react";

import {
    CrosshairIcon,
    LandIcon,
    LocationIcon,
} from "@/components/ui/Icons";
import {
    formatDistance,
    formatHectares,
} from "@/lib/format";
import type {
    DeviceLocation,
    FieldTarget,
} from "@/types/cadastre";
import type { FieldLocationStatus } from "@/hooks/useFieldLocation";

function BackIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 5-7 7 7 7" />
        </svg>
    );
}

function AccuracyIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
    );
}

export function FieldModePanel({
                                   active,
                                   status,
                                   location,
                                   target,
                                   error,
                                   lockedToSelection,
                                   onStart,
                                   onStop,
                                   onCenterUser,
                                   onCenterParcel,
                                   onUseDetectedParcel,
                                   onAutoDetect,
                               }: {
    active: boolean;
    status: FieldLocationStatus;
    location: DeviceLocation | null;
    target: FieldTarget | null;
    error: string | null;
    lockedToSelection: boolean;
    onStart: () => void;
    onStop: () => void;
    onCenterUser: () => void;
    onCenterParcel: () => void;
    onUseDetectedParcel: () => void;
    onAutoDetect: () => void;
}) {
    const mobileContentRef =
        useRef<HTMLDivElement | null>(null);

    const [mobileCollapsed, setMobileCollapsed] =
        useState(false);

    const dragStartYRef =
        useRef<number | null>(null);

    useEffect(() => {
        if (!active) {
            document.documentElement.style.removeProperty(
                "--field-mobile-panel-height",
            );
            return;
        }

        const element = mobileContentRef.current;

        if (!element) {
            return;
        }

        const updateHeight = () => {
            document.documentElement.style.setProperty(
                "--field-mobile-panel-height",
                `${Math.ceil(element.getBoundingClientRect().height)}px`,
            );
        };

        updateHeight();

        const observer =
            new ResizeObserver(updateHeight);

        observer.observe(element);

        return () => {
            observer.disconnect();

            document.documentElement.style.removeProperty(
                "--field-mobile-panel-height",
            );
        };
    }, [
        active,
        error,
        location,
        lockedToSelection,
        status,
        target,
        mobileCollapsed,
    ]);

    if (!active) {
        return (
            <button
                type="button"
                className="map-action field-mode-trigger"
                onClick={onStart}
            >
                <LocationIcon />
                Modo campo
            </button>
        );
    }

    const uncertaintyDominates = Boolean(
        location &&
        target &&
        location.accuracy >
        target.boundary_distance_m,
    );

    const targetName =
        target?.parcel.properties.name?.trim() ||
        target?.parcel.properties.cadastral_ref ||
        "Sin finca detectada";

    return (
        <>
            {/* ===============================================================
          DESKTOP — existing compact panel
          =============================================================== */}
            <section
                className="field-panel field-panel-desktop"
                aria-live="polite"
            >
                <div className="field-panel-head">
                    <div className="field-title-block">
            <span className="field-kicker">
              Modo campo
            </span>

                        <strong>
                            {status === "requesting"
                                ? "Buscando tu posición…"
                                : "Seguimiento GPS"}
                        </strong>
                    </div>

                    <button
                        type="button"
                        className="small-ghost-button"
                        onClick={onStop}
                    >
                        Salir
                    </button>
                </div>

                {error ? (
                    <div className="field-error">
                        {error}
                    </div>
                ) : null}

                {location ? (
                    <div className="field-gps-row">
                        <span className="field-gps-dot" />
                        <span>
              GPS ±
                            {Math.round(
                                location.accuracy,
                            )}{" "}
                            m
            </span>

                        {location.speed != null &&
                        location.speed > 0.5 ? (
                            <span>
                {Math.round(
                    location.speed * 3.6,
                )}{" "}
                                km/h
              </span>
                        ) : null}
                    </div>
                ) : null}

                {target ? (
                    <>
                        <div className="field-target-card">
                            <div className="field-target-icon">
                                <LandIcon />
                            </div>

                            <div className="field-target-main">
                <span>
                  {lockedToSelection
                      ? "Finca seleccionada"
                      : "Finca detectada"}
                </span>

                                <strong>
                                    {targetName}
                                </strong>

                                <small>
                                    {formatHectares(
                                        target.parcel.properties
                                            .area_ha,
                                    )}
                                    {target.group_name
                                        ? ` · ${target.group_name}`
                                        : ""}
                                </small>
                            </div>

                            <div
                                className={
                                    target.inside
                                        ? "field-state is-inside"
                                        : "field-state is-outside"
                                }
                            >
                                {target.inside
                                    ? "Dentro"
                                    : "Fuera"}
                            </div>
                        </div>

                        <div className="field-distance-card">
              <span>
                {target.inside
                    ? "Límite más cercano"
                    : "Distancia al límite"}
              </span>

                            <strong>
                                {formatDistance(
                                    target.boundary_distance_m,
                                )}
                            </strong>

                            {uncertaintyDominates ? (
                                <small>
                                    La precisión GPS actual
                                    es mayor que esta
                                    distancia.
                                </small>
                            ) : (
                                <small>
                                    Posición orientativa; no
                                    sustituye una medición
                                    topográfica.
                                </small>
                            )}
                        </div>

                        <div className="field-actions">
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={onCenterUser}
                            >
                                <LocationIcon />
                                Centrarme
                            </button>

                            <button
                                type="button"
                                className="secondary-button"
                                onClick={onCenterParcel}
                            >
                                <CrosshairIcon />
                                Ver finca
                            </button>

                            {lockedToSelection ? (
                                <button
                                    type="button"
                                    className="field-link-button"
                                    onClick={onAutoDetect}
                                >
                                    Deseleccionar finca
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="field-link-button"
                                    onClick={
                                        onUseDetectedParcel
                                    }
                                >
                                    Seleccionar esta finca
                                </button>
                            )}
                        </div>
                    </>
                ) : location && !error ? (
                    <div className="field-empty">
                        <strong>
                            No hay una finca guardada
                            cerca.
                        </strong>

                        <span>
              Guarda primero la parcela o
              selecciona una de tu
              biblioteca.
            </span>
                    </div>
                ) : null}
            </section>

            {/* ===============================================================
          MOBILE — mockup-inspired field mode
          =============================================================== */}
            <section
                className="field-mobile-shell"
                aria-live="polite"
            >
                <header className="field-mobile-header">
                    <button
                        type="button"
                        className="field-mobile-back"
                        onClick={onStop}
                        aria-label="Salir de Modo Campo"
                    >
                        <BackIcon />
                    </button>

                    <div>
                        <span>Seguimiento GPS</span>
                        <strong>Modo Campo</strong>
                    </div>

                    <div className="field-mobile-live">
                        <span className="field-mobile-live-dot" />
                        <span>
              {status === "requesting"
                  ? "Buscando"
                  : "Activo"}
            </span>
                    </div>
                </header>

                <div
                    ref={mobileContentRef}
                    className={
                        mobileCollapsed
                            ? "field-mobile-content is-collapsed"
                            : "field-mobile-content"
                    }
                >
                    <button
                        type="button"
                        className="field-mobile-sheet-handle"
                        aria-label={
                            mobileCollapsed
                                ? "Mostrar información de Modo Campo"
                                : "Ocultar información de Modo Campo"
                        }
                        onClick={() =>
                            setMobileCollapsed(
                                (current) => !current,
                            )
                        }
                        onPointerDown={(event) => {
                            dragStartYRef.current =
                                event.clientY;
                        }}
                        onPointerUp={(event) => {
                            const start =
                                dragStartYRef.current;

                            dragStartYRef.current =
                                null;

                            if (start == null) {
                                return;
                            }

                            const delta =
                                event.clientY - start;

                            if (delta > 38) {
                                setMobileCollapsed(true);
                            }

                            if (delta < -38) {
                                setMobileCollapsed(false);
                            }
                        }}
                    >
                        <span />
                    </button>

                    <div className="field-mobile-sheet-body">
                        {error ? (
                            <div className="field-mobile-error">
                                {error}
                            </div>
                        ) : null}

                        <div className="field-mobile-gps-card">
            <span className="field-mobile-gps-icon">
              <AccuracyIcon />
            </span>

                            <span className="field-mobile-gps-copy">
              <small>Precisión GPS</small>
              <strong>
                {location
                    ? `±${Math.round(
                        location.accuracy,
                    )} m`
                    : "—"}
              </strong>
            </span>

                            {location?.speed != null &&
                            location.speed > 0.5 ? (
                                <span className="field-mobile-speed">
                {Math.round(
                    location.speed * 3.6,
                )}{" "}
                                    km/h
              </span>
                            ) : null}
                        </div>

                        {target ? (
                            <>
                                <div className="field-mobile-target-card">
                                    <div className="field-mobile-target-top">
                  <span className="field-mobile-land-icon">
                    <LandIcon />
                  </span>

                                        <div className="field-mobile-target-copy">
                                            <small>
                                                {lockedToSelection
                                                    ? "Finca seleccionada"
                                                    : "Finca detectada"}
                                            </small>

                                            <strong>
                                                {targetName}
                                            </strong>

                                            <span>
                      {formatHectares(
                          target.parcel
                              .properties
                              .area_ha,
                      )}
                                                {target.group_name
                                                    ? ` · ${target.group_name}`
                                                    : ""}
                    </span>
                                        </div>

                                        <span
                                            className={
                                                target.inside
                                                    ? "field-mobile-state is-inside"
                                                    : "field-mobile-state is-outside"
                                            }
                                        >
                    {target.inside
                        ? "DENTRO"
                        : "FUERA"}
                  </span>
                                    </div>
                                </div>

                                <div className="field-mobile-distance">
                <span>
                  {target.inside
                      ? "Límite más cercano"
                      : "Distancia al límite"}
                </span>

                                    <strong>
                                        {formatDistance(
                                            target.boundary_distance_m,
                                        )}
                                    </strong>

                                    <small>
                                        {uncertaintyDominates
                                            ? "La precisión GPS actual es mayor que esta distancia."
                                            : "Orientativo. No sustituye una medición topográfica."}
                                    </small>
                                </div>

                                <div className="field-mobile-actions">
                                    <button
                                        type="button"
                                        className="field-mobile-secondary"
                                        onClick={onCenterUser}
                                    >
                                        <LocationIcon />
                                        Centrarme
                                    </button>

                                    <button
                                        type="button"
                                        className="field-mobile-primary"
                                        onClick={onCenterParcel}
                                    >
                                        <CrosshairIcon />
                                        Ver finca
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    className="field-mobile-link"
                                    onClick={
                                        lockedToSelection
                                            ? onAutoDetect
                                            : onUseDetectedParcel
                                    }
                                >
                                    {lockedToSelection
                                        ? "Deseleccionar finca"
                                        : "Seleccionar esta finca"}
                                </button>
                            </>
                        ) : location && !error ? (
                            <div className="field-mobile-empty">
              <span className="field-mobile-land-icon">
                <LandIcon />
              </span>

                                <div>
                                    <strong>
                                        No hay una finca
                                        guardada cerca
                                    </strong>
                                    <span>
                  Guarda primero la parcela
                  o selecciona una de tu
                  biblioteca.
                </span>
                                </div>
                            </div>
                        ) : (
                            <div className="field-mobile-searching">
                                <span className="field-mobile-pulse" />
                                <strong>
                                    Buscando tu posición…
                                </strong>
                                <span>
                Permite el acceso al GPS
                para localizarte respecto
                a tus parcelas.
              </span>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </>
    );
}
