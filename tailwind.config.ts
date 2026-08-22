import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        accent: { DEFAULT: '#2d2b3d', light: '#3d3a50', 50: '#f0eff5', 100: '#d9d8e6', 200: '#b3b1cc' },
        plum: { DEFAULT: '#6b5b73', light: '#8b7e91' },
        sage: { DEFAULT: '#7a8b6f', light: '#95a68a' },
        ivory: { DEFAULT: '#f8f6f3', dark: '#efe9e2' },
        warm: { DEFAULT: '#8b7e74', light: '#a89d94' },
      },
      maxWidth: { content: '1280px', narrow: '800px' },
    },
  },
  plugins: [],
};
export default config;
