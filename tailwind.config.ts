import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#191f28",
        mist: "#f7f8fa",
        surface: "#ffffff",
        "surface-muted": "#f1f4f8",
        "text-secondary": "#475569",
        "text-muted": "#64748b",
        trust: "#3182f6",
        "trust-text": "#1d4ed8",
        focus: "#1d4ed8",
        mint: "#00a881",
        "mint-text": "#047857",
        coral: "#f04452",
        "coral-text": "#be123c",
        line: "#e5e8eb",
        "line-strong": "#cbd5e1",
        "warning-text": "#92400e"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(25, 31, 40, 0.06)",
        raised: "0 12px 34px rgba(25, 31, 40, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
