/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,ts,tsx}",
    "./src/**/*.{js,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        dawn: "#FAF7F2",
        dusk: "#1A1614",
        clay: "#3D3530",
        mist: "#B8AFA6",
        ember: "#D4845A",
        bloom: "#6B9E78",
        stream: "#0D47A1",
      },
      fontFamily: {
        inter: ["Inter_400Regular"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
      },
    },
  },
  plugins: [],
};
