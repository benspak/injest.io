/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Spotify dark theme colors
        background: '#121212',
        foreground: '#ffffff',
        card: '#1a1a1a',
        'card-hover': '#242424',
        border: '#2a2a2a',
        primary: '#1db954', // Spotify green
        'primary-hover': '#1ed760',
        secondary: '#b3b3b3',
        muted: '#727272',
        destructive: '#e22134',
      },
    },
  },
  plugins: [],
};
