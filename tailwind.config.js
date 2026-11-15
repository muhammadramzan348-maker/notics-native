/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#09090B",
        surface: "#141417",
        line: "#27272A",
        ink: "#FAFAFA",
        muted: "#A1A1AA",
        cyan: "#06B6D4",
        emerald: "#10B981",
        crimson: "#EF4444",
        amber: "#F59E0B",
      },
    },
  },
  plugins: [],
};
