import { useEffect, useState } from "react";
import type { Page } from "../models/navigation";

export function useAppController<TCourse>() {
  const [page, setPage] = useState<Page>("home");
  const [selectedCourse, setSelectedCourse] = useState<TCourse | null>(null);
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

  const navigate = (destination: Page) => {
    setPage(destination);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const viewCourse = (course: TCourse) => {
    setSelectedCourse(course);
    navigate("course-detail");
  };

  return {
    page, selectedCourse, darkMode,
    navigate, viewCourse,
    toggleDarkMode: () => setDarkMode(value => !value),
    increaseFont: () => setFontScale(value => Math.min(1.25, Number((value + 0.05).toFixed(2)))),
    decreaseFont: () => setFontScale(value => Math.max(0.85, Number((value - 0.05).toFixed(2)))),
  };
}
