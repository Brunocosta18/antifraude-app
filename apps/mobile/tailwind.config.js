/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        risk: {
          high: '#dc2626',
          attention: '#f59e0b',
          none: '#16a34a',
        },
      },
    },
  },
  plugins: [],
};
