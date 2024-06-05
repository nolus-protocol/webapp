/** @type {import('tailwindcss').Config} */
export default {
  presets: [require("web-components/dist/tailwind.config.js")],
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "orange-active": "var(--color-text-active)",
        "text-main": "#082D63",
        "light-grey": "#f7f9fc",
        grey: "#ebeff5",
        "light-blue": "#8396B1",
        "medium-blue": "#5e7699",
        "dark-blue": "#082d63",
        "light-electric": "#2868e1",
        "medium-electric": "#245dc7",
        "dark-electric": "#1f51ad",
        "light-red": "#e42929",
        "medium-red": "#c92424",
        "dark-red": "#b02020",
        "light-green": "#50e3a5",
        "medium-green": "#47c993",
        "dark-green": "#1ab171",
        "light-yellow": "#ffd782",
        "medium-yellow": "#ffc74f",
        "dark-yellow": "#ffb922",
        dark: "#082D63"
      },
      textColor: {
        primary: "var(--color-text-primary)"
      },
      backgroundColor: {
        primary: "var(--color-bg-primary)"
      },
      fontFamily: {
        garet: ["Garet"],
        "garet-light": ["Garet-Light"],
        "garet-medium": ["Garet-Medium"],
        "garet-bold": ["Garet-Bold"],
        "garet-bolder": ["Garet-Black"]
      },
      boxShadow: {
        lease: "0px 4px 6px -1px rgba(0, 0, 0, 0.10), 0px 2px 4px -2px rgba(0, 0, 0, 0.10)"
      }
    }
  },
  plugins: []
};
