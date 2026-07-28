/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canal: {
          50: "#eefbfb",
          100: "#d3f3f4",
          200: "#a6e6e9",
          300: "#6fd3d9",
          400: "#3bb8c2",
          500: "#1f97a3",
          600: "#187a86",
          700: "#16626c",
          800: "#164f58",
          900: "#15424a",
          950: "#07272d",
        },
        paddy: {
          50: "#f1faec",
          100: "#dff3d3",
          200: "#c0e7ab",
          300: "#97d478",
          400: "#71bd4e",
          500: "#529f34",
          600: "#3f7f27",
          700: "#336422",
          800: "#2c4f20",
          900: "#26431f",
          950: "#11250d",
        },
        earth: {
          50: "#faf7f2",
          100: "#f1e9db",
          800: "#4a3826",
          900: "#33261a",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
      backgroundImage: {
        ripple: "radial-gradient(circle at top left, rgba(31,151,163,0.25), transparent 55%), radial-gradient(circle at bottom right, rgba(82,159,52,0.2), transparent 55%)",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(15, 60, 66, 0.15)",
      },
    },
  },
  plugins: [],
};
