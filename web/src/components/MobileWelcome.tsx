"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./MobileWelcome.module.css";

const WELCOME_STORAGE_KEY = "catastro.mobileWelcomeCompleted";

const SLIDES = [
    { src: "/onboarding/welcome-1.png", alt: "Catastro Digital" },
    { src: "/onboarding/welcome-2.png", alt: "Catastro Digital sin cuenta" },
    { src: "/onboarding/welcome-3.png", alt: "Catastro Digital Modo Campo" },
] as const;

export function MobileWelcome() {
    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);
    const [slide, setSlide] = useState(0);
    const dragStartX = useRef<number | null>(null);

    useEffect(() => {
        const isMobile = window.matchMedia("(max-width: 720px)").matches;
        const alreadyCompleted =
            window.localStorage.getItem(WELCOME_STORAGE_KEY) === "true";

        if (isMobile && !alreadyCompleted) {
            setVisible(true);
        }
    }, []);

    const finish = () => {
        window.localStorage.setItem(WELCOME_STORAGE_KEY, "true");
        setClosing(true);

        window.setTimeout(() => {
            setVisible(false);
        }, 260);
    };

    const next = () => {
        if (slide < SLIDES.length - 1) {
            setSlide((current) => current + 1);
            return;
        }
        finish();
    };

    const previous = () => {
        setSlide((current) => Math.max(0, current - 1));
    };

    const handlePointerDown = (
        event: React.PointerEvent<HTMLDivElement>,
    ) => {
        dragStartX.current = event.clientX;
    };

    const handlePointerUp = (
        event: React.PointerEvent<HTMLDivElement>,
    ) => {
        if (dragStartX.current == null) return;

        const delta = event.clientX - dragStartX.current;
        dragStartX.current = null;

        if (delta <= -45) next();
        else if (delta >= 45) previous();
    };

    if (!visible) return null;

    return (
        <section
            className={`${styles.root} ${closing ? styles.closing : ""}`}
            aria-label="Bienvenida a Catastro Digital"
        >
            <div
                className={styles.stage}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
            >
                <img
                    key={SLIDES[slide].src}
                    src={SLIDES[slide].src}
                    alt={SLIDES[slide].alt}
                    className={styles.slide}
                    draggable={false}
                />

                <button
                    type="button"
                    className={styles.ctaHitArea}
                    onClick={next}
                    aria-label={
                        slide === SLIDES.length - 1 ? "Comenzar" : "Continuar"
                    }
                />

                <div className={styles.dotsHitArea} aria-label="Diapositivas">
                    {SLIDES.map((item, index) => (
                        <button
                            type="button"
                            key={item.src}
                            className={styles.dotHit}
                            aria-label={`Ir a la diapositiva ${index + 1}`}
                            onClick={() => setSlide(index)}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
