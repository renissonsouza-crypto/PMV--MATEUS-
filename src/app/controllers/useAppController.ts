import { useEffect, useRef, useState } from "react";
import type { Page } from "../models/navigation";

const NAVIGATION_KEY = "qualificavixNavigation";
const PAGES = new Set<Page>(["home", "cursos", "course-detail", "sobre", "categorias", "contato", "register", "profile", "favorites", "enrollment-confirmation"]);
type NavigationEntry = { page: Page; courseId: number | null; scrollY: number };

export function useAppController<TCourse extends { id: number }>(courses: readonly TCourse[], resolvePage: (page: Page) => Page = page => page) {
  const resolvePageRef = useRef(resolvePage);
  resolvePageRef.current = resolvePage;
  const readEntry = (): NavigationEntry => {
    const value = window.history.state?.[NAVIGATION_KEY];
    const page = PAGES.has(value?.page) ? value.page as Page : "home";
    const courseId = courses.some(course => course.id === value?.courseId) ? value.courseId as number : null;
    const destination = resolvePageRef.current(page);
    return {
      page: (destination === "course-detail" || destination === "enrollment-confirmation") && !courseId ? "cursos" : destination,
      courseId,
      scrollY: Number.isFinite(value?.scrollY) && value.scrollY >= 0 ? value.scrollY : 0,
    };
  };
  const [navigation, setNavigation] = useState<NavigationEntry>(readEntry);
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  const pendingScroll = useRef<{ top: number; behavior: ScrollBehavior } | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("qualificavix-dark-mode") === "true"; }
    catch { return false; }
  });
  const [fontScale, setFontScale] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("qualificavix-font-scale"));
      return Number.isFinite(saved) && saved >= 0.85 && saved <= 1.25 ? saved : 1;
    } catch { return 1; }
  });

  useEffect(() => {
    try {
      localStorage.setItem("qualificavix-dark-mode", String(darkMode));
      localStorage.setItem("qualificavix-font-scale", String(fontScale));
    } catch { /* Preferências funcionam mesmo sem armazenamento. */ }
    document.documentElement.classList.toggle("qualificavix-dark", darkMode);
    document.documentElement.style.fontSize = `${16 * fontScale}px`;
    return () => {
      document.documentElement.classList.remove("qualificavix-dark");
      document.documentElement.style.fontSize = "";
    };
  }, [darkMode, fontScale]);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    // Store only a page, a public catalogue ID and scroll position, never profile data.
    window.history.replaceState({ ...window.history.state, [NAVIGATION_KEY]: navigationRef.current }, "");
    const restore = () => {
      const entry = readEntry();
      pendingScroll.current = { top: entry.scrollY, behavior: "auto" };
      setNavigation(entry);
    };
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useEffect(() => {
    const scroll = pendingScroll.current;
    pendingScroll.current = null;
    if (!scroll) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("main")?.focus({ preventScroll: true });
      window.scrollTo(scroll);
    });
    return () => cancelAnimationFrame(frame);
  }, [navigation]);

  const transition = (destination: Page, courseId = navigationRef.current.courseId) => {
    const current = navigationRef.current;
    const entry: NavigationEntry = { page: destination, courseId, scrollY: 0 };
    if (current.page === destination && current.courseId === courseId) {
      window.history.replaceState({ ...window.history.state, [NAVIGATION_KEY]: entry }, "");
    } else {
      window.history.replaceState({ ...window.history.state, [NAVIGATION_KEY]: { ...current, scrollY: window.scrollY } }, "");
      window.history.pushState({ [NAVIGATION_KEY]: entry }, "");
    }
    pendingScroll.current = { top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" };
    navigationRef.current = entry;
    setNavigation(entry);
  };
  const navigate = (destination: Page) => transition(destination);
  const viewCourse = (course: TCourse) => transition("course-detail", course.id);

  return {
    page: navigation.page,
    selectedCourse: courses.find(course => course.id === navigation.courseId) ?? null,
    darkMode, navigate, viewCourse,
    toggleDarkMode: () => setDarkMode(value => !value),
    increaseFont: () => setFontScale(value => Math.min(1.25, Number((value + 0.05).toFixed(2)))),
    decreaseFont: () => setFontScale(value => Math.max(0.85, Number((value - 0.05).toFixed(2)))),
  };
}
