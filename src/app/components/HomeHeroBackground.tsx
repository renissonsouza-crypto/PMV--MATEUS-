import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { HERO_IMAGES } from "../data/heroImages";

const ROTATION_INTERVAL = 7500;

/** A photographic hero with manual controls and a motion-aware rotation. */
export function HomeHeroBackground({ children }: { children: ReactNode }) {
  const [slide, setSlide] = useState({ current: 0, previous: null as number | null });
  const [paused, setPaused] = useState(false);
  const [loadedSlides, setLoadedSlides] = useState<Set<number>>(() => new Set());
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(preference.matches);
    const updateVisibility = () => setPageVisible(!document.hidden);
    preference.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      preference.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    // A remounted image must confirm its own load; browser caches may evict it.
    setLoadedSlides(current => {
      const retained = [...current].filter(index => index === slide.current || index === slide.previous);
      return retained.length === current.size ? current : new Set(retained);
    });
  }, [slide.current, slide.previous]);

  const currentLoaded = loadedSlides.has(slide.current);
  useEffect(() => {
    if (paused || reducedMotion || !pageVisible || !currentLoaded || HERO_IMAGES.length < 2) return;
    const timer = window.setInterval(() => {
      setSlide(current => ({
        current: (current.current + 1) % HERO_IMAGES.length,
        previous: current.current,
      }));
    }, ROTATION_INTERVAL);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, pageVisible, slide.current, currentLoaded]);

  const moveSlide = (direction: number) => {
    setSlide(current => ({
      current: (current.current + direction + HERO_IMAGES.length) % HERO_IMAGES.length,
      previous: loadedSlides.has(current.current) ? current.current : current.previous,
    }));
  };
  const visibleIndex = currentLoaded || slide.previous === null ? slide.current : slide.previous;
  const active = HERO_IMAGES[visibleIndex];
  const controlClass = "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-slate-950/35 text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

  return (
    <section className="relative overflow-hidden bg-slate-950" style={{ background: "linear-gradient(135deg, #0a2f61 0%, #0057d9 65%, #0078ce 100%)" }} aria-label="Oportunidades de qualificação em Vitória">
      <style>{`
        .home-hero-photo { object-position: var(--photo-desktop-position); }
        .home-hero-photo-enter { animation: home-hero-photo-reveal 1000ms ease-out both; }
        .home-hero-shade { background: linear-gradient(90deg, rgba(3, 20, 45, .94) 0%, rgba(3, 20, 45, .85) 30%, rgba(3, 20, 45, .5) 52%, rgba(3, 20, 45, .08) 85%), linear-gradient(0deg, rgba(3, 20, 45, .7) 0%, transparent 30%); }
        @keyframes home-hero-photo-reveal { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 1023px) {
          .home-hero-photo { object-position: var(--photo-mobile-position); }
          .home-hero-shade { background: linear-gradient(90deg, rgba(3, 20, 45, .85), rgba(3, 20, 45, .55)), linear-gradient(0deg, rgba(3, 20, 45, .8) 0%, transparent 55%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .home-hero-photo-enter { animation: none; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {[slide.previous, slide.current].filter((index): index is number => index !== null).map(index => {
          const photograph = HERO_IMAGES[index];
          const isActive = index === slide.current;
          return (
            <img
              key={photograph.id}
              src={photograph.src}
              srcSet={photograph.srcSet}
              sizes="100vw"
              width={photograph.width}
              height={photograph.height}
              alt=""
              decoding="async"
              loading="eager"
              {...{ fetchpriority: index === 0 ? "high" : "auto" }}
              onLoad={() => setLoadedSlides(current => current.has(index) ? current : new Set([...current, index]))}
              className={`home-hero-photo absolute inset-0 h-full w-full object-cover ${!loadedSlides.has(index) ? "opacity-0" : isActive && slide.previous !== null ? "home-hero-photo-enter" : ""}`}
              style={{
                "--photo-desktop-position": photograph.desktopPosition,
                "--photo-mobile-position": photograph.mobilePosition,
                zIndex: isActive ? 1 : 0,
              } as CSSProperties}
            />
          );
        })}
        <div className="home-hero-shade absolute inset-0 z-10" />
      </div>

      <div className="relative z-10">{children}</div>

      <div className="relative z-10 mx-auto flex max-w-7xl justify-end px-4 pb-16 sm:px-6 lg:px-8" role="group" aria-roledescription="carrossel" aria-label="Fotos de Vitória e da qualificação profissional" aria-busy={!currentLoaded}>
        <span className="sr-only" aria-live="off">{active.alt}</span>
        <div className="flex shrink-0 items-center gap-2" aria-label="Controles das fotografias">
          <button type="button" className={controlClass} onClick={() => moveSlide(-1)} aria-label="Mostrar foto anterior">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-10 text-center text-xs font-semibold tabular-nums text-white" aria-live="off" aria-label={`Foto ${visibleIndex + 1} de ${HERO_IMAGES.length}`}>
            {visibleIndex + 1} / {HERO_IMAGES.length}
          </span>
          <button type="button" className={controlClass} onClick={() => moveSlide(1)} aria-label="Mostrar próxima foto">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          {!reducedMotion && (
            <button
              type="button"
              className={controlClass}
              onClick={() => setPaused(current => !current)}
              aria-label={paused ? "Retomar alternância das fotos" : "Pausar alternância das fotos"}
              aria-pressed={paused}
            >
              {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          )}
          {reducedMotion && <span className="ml-1 text-[10px] text-slate-200">Troca manual</span>}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 overflow-hidden" aria-hidden="true">
        <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="block w-full">
          <path d="M0 48L1440 48L1440 0C1440 0 1200 40 720 40C240 40 0 0 0 0L0 48Z" fill="white" />
        </svg>
      </div>
    </section>
  );
}
