import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Clarity City', 'Helvetica Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
