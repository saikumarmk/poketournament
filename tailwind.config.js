/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gb: {
          bg: '#1a1a2e',
          card: '#16213e',
          hover: '#1f2b47',
          border: '#2a3a5c',
          text: '#e8e8e8',
          dim: '#8892a8',
          muted: '#5a6580',
          accent: '#e2b714',
          win: '#4ade80',
          loss: '#f87171',
          link: '#93b4f5',
        },
      },
      fontFamily: {
        pokemon: ['"Pokemon GB"', '"Press Start 2P"', 'monospace'],
        readable: ['"Fira Code"', '"Fira Mono"', '"Cascadia Code"', '"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      fontSize: {
        xxs: '0.55rem',
      },
    },
  },
  plugins: [],
};
