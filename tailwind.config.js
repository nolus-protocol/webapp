module.exports = {
  purge: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    colors: {
      white: '#fff',
      'text-main': '#072d63',
      'light-grey': '#f7f9fc',
      grey: '#ebeff5',
      'light-blue': '#8395b0',
      'medium-blue': '#5e7699',
      'dark-blue': '#082d63',
      'light-electric': '#2868e1',
      'medium-electric': '#245dc7',
      'dark-electric': '#1f51ad',
      'light-red': '#e42929',
      'medium-red': '#c92424',
      'dark-red': '#b02020',
      'light-green': '#50e3a5',
      'medium-green': '#47c993',
      'dark-green': '#1ab171',
      'light-yellow': '#ffd782',
      'medium-yellow': '#ffc74f',
      'dark-yellow': '#ffb922',
      orange: '#ff562e',
      dark: '#07162c'
    },
    extend: {}
  },
  variants: {
    extend: {}
  },
  plugins: []
}
