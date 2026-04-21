/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-app': '#121212',
        'bg-surface': '#1E1E1E',
        'bubo-purple': '#8A2BE2',
        'insight-mint': '#00FFFF',
        'guiding-orange': '#FF9800',
        'quiet-grey': '#BDBDBD'
      },
      borderRadius: {
        '2xl': '16px'
      }
    }
  },
  plugins: []
};
