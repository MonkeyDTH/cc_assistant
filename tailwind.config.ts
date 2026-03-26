import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Claude 品牌色系
        claude: {
          50:  "#fdf4f0",
          100: "#fbe8e0",
          200: "#f7cfc0",
          300: "#f0a98a",
          400: "#e87a54",
          500: "#d97139",  // 主品牌色（橙红）
          600: "#c4612e",
          700: "#a34f26",
          800: "#844025",
          900: "#6c3622",
        },
        sidebar: {
          DEFAULT: "#1a1a2e",
          hover:   "#16213e",
          active:  "#0f3460",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
