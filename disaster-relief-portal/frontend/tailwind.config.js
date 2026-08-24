export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        relief: {
          bg: '#f6f8fc',
          surface: '#ffffff',
          border: '#e2e8f0',
          orange: '#ff7a42',
          teal: '#14b8a6'
        }
      }
    }
  },
  plugins: []
};
