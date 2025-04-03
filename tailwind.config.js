/** @type {import('tailwindcss').Config} */
export default {
  presets: [require("web-components/dist/tailwind.config.js")],
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {}
  },
  plugins: []
};
