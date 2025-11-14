/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/views/**/*.html.erb",
    "./app/javascript/**/*.{js,jsx,ts,tsx}"
  ],
  theme: { extend: {opacity: ['group-hover'],} },
  plugins: [require("@tailwindcss/typography")],
    safelist: [
    'text-[12px]', 'leading-6',
    'text-[14px]', 'leading-7',
    'text-base',   'leading-7',
    'text-[20px]', 'leading-8',
    'text-[24px]', 'leading-9',
  ],

};