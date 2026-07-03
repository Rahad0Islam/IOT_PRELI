/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#05060f',
          900: '#0b0f1f',
          800: '#111733',
          700: '#1a2244',
          600: '#26315a',
        },
        neon: {
          cyan: '#22d3ee',
          violet: '#8b5cf6',
          lime: '#a3e635',
          amber: '#f59e0b',
          rose: '#f43f5e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backgroundImage: {
        'grid-glow':
          'radial-gradient(ellipse at top, rgba(34,211,238,.15), transparent 60%), radial-gradient(ellipse at bottom right, rgba(139,92,246,.18), transparent 60%)',
      },
      keyframes: {
        spin_slow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        pulse_glow: {
          '0%, 100%': { boxShadow: '0 0 18px 2px rgba(250,204,21,.55)' },
          '50%': { boxShadow: '0 0 38px 8px rgba(250,204,21,.85)' },
        },
        slide_up: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        fade_in: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
      animation: {
        'spin-slow': 'spin_slow 2.4s linear infinite',
        'pulse-glow': 'pulse_glow 2.4s ease-in-out infinite',
        'slide-up': 'slide_up .35s ease-out both',
        'fade-in': 'fade_in .4s ease-out both',
      },
    },
  },
  plugins: [],
};