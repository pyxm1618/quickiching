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
  weight: ["400", "500", "600", "700"],
  display: "swap",
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
  notoSerifSC.variable,
].join(" ");
