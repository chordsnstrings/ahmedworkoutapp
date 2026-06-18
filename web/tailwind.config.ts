import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0a0e14',
          800: '#0f1620',
          700: '#16202e',
          600: '#1e2a3a',
          500: '#2a3a4f',
        },
        accent: {
          DEFAULT: '#22d3ee',
          soft: '#0e7490',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
