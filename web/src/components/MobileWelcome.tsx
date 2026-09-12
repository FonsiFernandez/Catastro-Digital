"use client";

import { useEffect, useState } from "react";

const WELCOME_STORAGE_KEY =
    "catastro.mobileWelcomeCompleted";

function BrandMark() {
    return (
        <span className="mobile-welcome-brand-mark">
      <svg
          viewBox="0 0 32 32"
          aria-hidden="true"
      >
        <path d="M16 5.5c-4.4 0-8 3.6-8 8 0 6 8 13 8 13s8-7 8-13c0-4.4-3.6-8-8-8Z" />
        <circle cx="16" cy="13.5" r="2.7" />
      </svg>
    </span>
    );
}

function TerrainArtwork() {
    return (
        <svg
            className="mobile-welcome-artwork"
            viewBox="0 0 420 360"
            role="img"
            aria-label="Ilustración topográfica"
        >
            <defs>
                <linearGradient
                    id="welcome-land"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                >
                    <stop
                        offset="0%"
                        stopColor="#7f9988"
                    />
                    <stop
                        offset="100%"
                        stopColor="#456b57"
                    />
                </linearGradient>

                <linearGradient
                    id="welcome-field"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                >
                    <stop
                        offset="0%"
                        stopColor="#d9c394"
                    />
                    <stop
                        offset="100%"
                        stopColor="#bea16d"
                    />
                </linearGradient>

                <filter
                    id="welcome-shadow"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                >
                    <feDropShadow
                        dx="0"
                        dy="12"
                        stdDeviation="14"
                        floodColor="#203c2d"
                        floodOpacity=".16"
                    />
                </filter>
            </defs>

            <path
                d="M20 164C71 121 111 116 145 87c47-40 74-58 132-43 54 14 81 52 123 72v200H20Z"
                fill="url(#welcome-land)"
                opacity=".96"
            />

            <path
                d="M44 239c54-26 95-20 131-46 42-30 79-31 121-9 35 18 62 16 103 3v129H44Z"
                fill="#365f4b"
                opacity=".42"
            />

            <path
                d="M57 151c43-35 81-45 115-71 39-30 89-23 130 3l-60 77-83 33-76 46Z"
                fill="url(#welcome-field)"
                opacity=".94"
                filter="url(#welcome-shadow)"
            />

            <path
                d="M59 155c42-26 75-28 108-55 34-27 81-24 118 0"
                fill="none"
                stroke="#f4ecdc"
                strokeWidth="4"
                strokeLinecap="round"
                opacity=".84"
            />

            <path
                d="M73 182c44-22 77-20 115-48 28-20 64-19 98-3"
                fill="none"
                stroke="#f4ecdc"
                strokeWidth="2.4"
                strokeLinecap="round"
                opacity=".58"
            />

            <path
                d="M91 213c37-20 70-22 107-45 36-23 73-24 108-10"
                fill="none"
                stroke="#f4ecdc"
                strokeWidth="2"
                strokeLinecap="round"
                opacity=".42"
            />

            <path
                d="M24 286c47-34 81-33 122-15 33 14 65 13 103-7 39-20 91-15 148 12"
                fill="none"
                stroke="#d8e1d9"
                strokeWidth="3"
                strokeLinecap="round"
                opacity=".48"
            />

            <g
                fill="none"
                stroke="#365f4b"
                opacity=".22"
            >
                <path d="M26 118c45-31 76-34 116-19 32 12 58 7 86-11 37-24 79-23 136 3" />
                <path d="M18 103c48-37 88-42 127-26 31 12 52 9 78-6 44-26 90-27 153 2" />
                <path d="M12 88c51-43 96-48 142-31 29 11 47 8 72-5 48-25 98-24 164 7" />
            </g>

            <g
                transform="translate(286 44)"
                filter="url(#welcome-shadow)"
            >
                <circle
                    cx="45"
                    cy="45"
                    r="38"
                    fill="#fffaf1"
                />
                <path
                    d="M45 20c-10.5 0-19 8.5-19 19 0 14.2 19 30 19 30s19-15.8 19-30c0-10.5-8.5-19-19-19Z"
                    fill="#365f4b"
                />
                <circle
                    cx="45"
                    cy="39"
                    r="6"
                    fill="#fffaf1"
                />
            </g>
        </svg>
    );
}

export function MobileWelcome() {
    const [visible, setVisible] =
        useState(false);

    const [closing, setClosing] =
        useState(false);

    useEffect(() => {
        const isMobile =
            window.matchMedia(
                "(max-width: 720px)",
            ).matches;

        const completed =
            window.localStorage.getItem(
                WELCOME_STORAGE_KEY,
            ) === "true";

        if (isMobile && !completed) {
            setVisible(true);
        }
    }, []);

    const completeWelcome = () => {
        window.localStorage.setItem(
            WELCOME_STORAGE_KEY,
            "true",
        );

        setClosing(true);

        window.setTimeout(() => {
            setVisible(false);
        }, 320);
    };

    if (!visible) {
        return null;
    }

    return (
        <section
            className={
                closing
                    ? "mobile-welcome is-closing"
                    : "mobile-welcome"
            }
            aria-label="Bienvenida a Catastro Digital"
        >
            <div className="mobile-welcome-top">
                <div className="mobile-welcome-brand">
                    <BrandMark />
                    <span>
            Catastro Digital
          </span>
                </div>

                <span className="mobile-welcome-badge">
          Parcelas · mapa · campo
        </span>
            </div>

            <div className="mobile-welcome-art">
                <TerrainArtwork />
            </div>

            <div className="mobile-welcome-copy">
        <span className="mobile-welcome-kicker">
          Tu territorio, organizado
        </span>

                <h1>
                    Tus parcelas.
                    <br />
                    Siempre contigo.
                </h1>

                <p>
                    Organiza tus fincas, consulta
                    información catastral y trabaja
                    sobre el terreno desde una única
                    aplicación.
                </p>
            </div>

            <div className="mobile-welcome-actions">
                <button
                    type="button"
                    className="mobile-welcome-primary"
                    onClick={completeWelcome}
                >
                    Empezar
                    <span aria-hidden="true">→</span>
                </button>

                <p>
                    Puedes empezar sin cuenta.
                    Tus datos se guardarán localmente
                    en este dispositivo.
                </p>
            </div>
        </section>
    );
}
