import { create } from "zustand";
const THEME_STORAGE_KEY = "chatify_theme";
const AVAILABLE_THEMES = [
    "midnight",
    "light",
    "amoled",
    "lavender",
    "ocean",
    "forest",
];
const getInitialTheme = () => {
    try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        return AVAILABLE_THEMES.includes(savedTheme)
            ? savedTheme
            : "midnight";
    } catch {
        return "midnight";
    }
};
export const useThemeStore = create((set, get) => ({
    theme: getInitialTheme(),
    setTheme: (theme) => {
        if (!AVAILABLE_THEMES.includes(theme)) return;
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch (error) {
            console.error("Failed to save Chatify theme:", error);
        }
        set({ theme });
    },
    resetTheme: () => {
        get().setTheme("midnight");
    },
}));
export { AVAILABLE_THEMES };
