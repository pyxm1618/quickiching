import { Fraunces, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  preload: false,
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  preload: false,
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  // Loaded on demand where mono text is actually rendered; the ritual landing itself uses Georgia.
  weight: ["400"],
  display: "swap",
  preload: false,
});

// Keep existing secondary weights available without preloading three unused faces.
const ibmPlexMonoSecondary = IBM_Plex_Mono({
  variable: "--font-plex-secondary",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  preload: false,
});

export const fontVariableClassNames = [
  fraunces.variable,
  instrumentSans.variable,
  ibmPlexMono.variable,
  ibmPlexMonoSecondary.variable,
].join(" ");
