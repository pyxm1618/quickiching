import { Fraunces, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
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
