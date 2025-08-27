/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./app/views/**/*.html.erb",
    "./app/javascript/**/*.{js,jsx,ts,tsx}"
  ],
  safelist: [
    'dark',
    'dark:prose-invert',
    'dark:bg-neutral-900',
    'dark:text-slate-100',
  ],
  plugins: [require("@tailwindcss/typography")],
}