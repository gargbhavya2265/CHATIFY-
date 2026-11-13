
import { CheckIcon, MoonIcon, SunIcon, XIcon } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";

const themes = [
  {
    id: "midnight",
    name: "Midnight",
    description: "The original Chatify experience",
    background: "#070912",
    surface: "#141427",
    secondary: "#1f213a",
    accent: "#8b5cf6",
    text: "#edf0ff",
  },
  {
    id: "light",
    name: "Light",
    description: "Clean and bright appearance",
    background: "#f1f5f9",
    surface: "#ffffff",
    secondary: "#e2e8f0",
    accent: "#7c3aed",
    text: "#1e293b",
  },
  {
    id: "amoled",
    name: "AMOLED",
    description: "Pure black surfaces",
    background: "#000000",
    surface: "#080808",
    secondary: "#171717",
    accent: "#a855f7",
    text: "#f5f5f5",
  },
  {
    id: "lavender",
    name: "Lavender",
    description: "A soft purple atmosphere",
    background: "#171225",
    surface: "#241b38",
    secondary: "#38284f",
    accent: "#c084fc",
    text: "#f3e8ff",
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "A calm blue atmosphere",
    background: "#081a2a",
    surface: "#102b40",
    secondary: "#19405a",
    accent: "#38bdf8",
    text: "#e0f2fe",
  },
  {
    id: "forest",
    name: "Forest",
    description: "A refreshing green atmosphere",
    background: "#101d17",
    surface: "#192b21",
    secondary: "#294333",
    accent: "#4ade80",
    text: "#dcfce7",
  },
];

function AppearanceModal({ isOpen, onClose }) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  if (!isOpen) return null;

  const handleThemeChange = (themeId) => {
    setTheme(themeId);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-700 p-5">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <SunIcon className="size-5 text-violet-400" />
              <h2
                id="appearance-title"
                className="text-lg font-semibold text-white"
              >
                Appearance
              </h2>
            </div>

            <p className="text-sm text-slate-400">
              Customize how your Chatify looks.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close appearance settings"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">
              Choose a theme
            </h3>

            <span className="text-xs text-slate-500">
              {themes.length} themes available
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {themes.map((item) => {
              const isSelected = theme === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleThemeChange(item.id)}
                  aria-pressed={isSelected}
                  className={`group relative rounded-xl border p-2 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-violet-400 ring-2 ring-violet-500/30"
                      : "border-slate-700 hover:border-slate-500"
                  }`}
                >
                  <div
                    className="relative mb-3 overflow-hidden rounded-lg border border-white/10 p-2"
                    style={{ backgroundColor: item.background }}
                  >
                    <div
                      className="mb-2 flex h-5 items-center gap-1.5 rounded-md px-2"
                      style={{ backgroundColor: item.surface }}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: item.accent }}
                      />

                      <span
                        className="h-1 w-10 rounded-full"
                        style={{ backgroundColor: item.text, opacity: 0.7 }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <div
                          className="h-5 w-7 rounded-md"
                          style={{ backgroundColor: item.secondary }}
                        />

                        <div
                          className="h-5 flex-1 rounded-md"
                          style={{ backgroundColor: item.surface }}
                        />
                      </div>

                      <div className="flex justify-end">
                        <div
                          className="h-4 w-3/5 rounded-md"
                          style={{ backgroundColor: item.accent }}
                        />
                      </div>
                    </div>

                    {isSelected && (
                      <div className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-violet-500 text-white shadow-lg">
                        <CheckIcon className="size-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-semibold text-slate-100">
                      {item.name}
                    </span>

                    {isSelected && (
                      <CheckIcon className="size-4 shrink-0 text-violet-400" />
                    )}
                  </div>

                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 bg-slate-950/40 px-5 py-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MoonIcon className="size-4" />
            Saved on this device
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default AppearanceModal;
