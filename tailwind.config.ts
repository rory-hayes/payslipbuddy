import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#e2e8f0",
        tide: "#0f766e",
        sky: "#0284c7"
      }
    }
  },
  plugins: []
};

export default config;
