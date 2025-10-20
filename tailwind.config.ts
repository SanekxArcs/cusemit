export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'drift': 'drift 0.3s ease-in-out',
      },
      keyframes: {
        'drift': {
          '0%, 100%': { transform: 'translate(var(--drift-x), var(--drift-y))' },
        },
      },
    },
  },
  plugins: [],
}
