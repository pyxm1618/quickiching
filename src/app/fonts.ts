import { Fraunces, IBM_Plex_Mono, Instrument_Sans, Noto_Serif_SC } from "next/font/google";

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
  // The visible ritual counter uses 400; keep its preload to avoid a late font request.
  weight: ["400"],
  display: "swap",
});

// Keep existing secondary weights available without preloading three unused faces.
const ibmPlexMonoSecondary = IBM_Plex_Mono({
  variable: "--font-plex-secondary",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  preload: false,
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-sc",
  weight: "variable",
  display: "swap",
  preload: false,
});

export const fontVariableClassNames = [
  fraunces.variable,
  instrumentSans.variable,
  ibmPlexMono.variable,
  ibmPlexMonoSecondary.variable,
].join(" ");

export const localizedFontVariableClassNames = [
  fontVariableClassNames,
  notoSerifSC.variable,
].join(" ");
