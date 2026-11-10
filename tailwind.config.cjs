/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/views/**/*.html.erb",
    "./app/javascript/**/*.{js,jsx,ts,tsx}"
  ],
  // No theme.extend.opacity here: Tailwind 4 reads a list there as theme values, so
  // ['group-hover'] made `opacity-0` mean "opacity: group-hover" and nothing using it ever hid.
  theme: { extend: {} },
  plugins: [require("@tailwindcss/typography")],
    safelist: [
    'text-[12px]', 'leading-6',
    'text-[14px]', 'leading-7',
    'text-base',   'leading-7',
    'text-[20px]', 'leading-8',
    'text-[24px]', 'leading-9',
  ],

};