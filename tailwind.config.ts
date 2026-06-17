import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep charcoal/black canvas
        ink: {
          900: '#08080c',
          800: '#0a0a0f',
          700: '#111118',
          600: '#16161f',
          500: '#1d1d28',
          400: '#262635',
          300: '#33333f',
        },
        // Electric lime — primary energy accent
        lime: {
          DEFAULT: '#c6ff00',
          400: '#d4ff3d',
          500: '#c6ff00',
          600: '#a8e000',
        },
        // Violet — secondary accent
        violet: {
          DEFAULT: '#7c5cff',
          400: '#9b82ff',
          500: '#7c5cff',
          600: '#6442e0',
        },
        // Cyan — tertiary (charts / data)
        aqua: '#00e0d0',
        coral: '#ff5c7c',
        amber: '#ffb02e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(198, 255, 0, 0.45)',
        'glow-violet': '0 0 24px -4px rgba(124, 92, 255, 0.5)',
        card: '0 8px 32px -8px rgba(0, 0, 0, 0.6)',
      },
      backgroundImage: {
        'lime-violet': 'linear-gradient(135deg, #c6ff00 0%, #7c5cff 100%)',
        'violet-aqua': 'linear-gradient(135deg, #7c5cff 0%, #00e0d0 100%)',
        'ink-fade': 'linear-gradient(180deg, #111118 0%, #08080c 100%)',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
