// Import the colors from the theme file
const { colors } = require('./src/theme/colors');
// const colorsTailwind = require('tailwindcss/colors'); // Can likely remove this now

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ...colors, // Spread the imported theme colors first
        // Add ONLY the EXTRA scales from the reference
        green: {
          400: "#22c55e",
          500: "#10b981",
          600: "#059669",
          900: "#064e3b",
        },
        red: {
          400: "#f87171",
          900: "#7f1d1d",
        },
        // Add zinc/purple only if they don't conflict with your imported theme
        // Or namespace them e.g., refZinc: { ... }
        zinc: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
        },
        purple: {
          50: "#f5f3ff",
          200: "#ddd6fe",
        },
      },
      borderRadius: {
        // Add shadcn defaults + reference sizes
        lg: "0.5rem",
        md: "calc(0.5rem - 2px)",
        sm: "calc(0.5rem - 4px)",
        xl: "0.75rem",
        '2xl': "1rem",
        '3xl': "1.5rem",
      },
      // Restore fontFamily
      fontFamily: {
        sans: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      }
      // Removed animations/keyframes from previous incorrect edit
    },
  },
  plugins: [],
};

