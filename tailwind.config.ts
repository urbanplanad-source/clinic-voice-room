import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#191f28",
        mist: "#f7f8fa",
        trust: "#3182f6",
        mint: "#00a881",
        coral: "#f04452",
        line: "#e5e8eb"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(25, 31, 40, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
