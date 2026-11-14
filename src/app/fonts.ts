import { Fraunces, IBM_Plex_Mono, Instrument_Sans, Pinyon_Script } from "next/font/google";

// Content display face. Hero titles are GildedTitle/Pinyon Script, so this face only
// serves content headings and the hub subtitle. It is not preloaded: the home page
// never sets --font-display, so a preload there cost ~37 kB of wasted mobile bandwidth
// and 2 points of Lighthouse home.mobile.
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

// Single authoritative title face. Every page/scene hero title renders through
// GildedTitle, so this is the only script face the product loads.
//
// The Google Fonts `latin` subset of Pinyon Script Regular. Kept on next/font/google
// rather than a locally subset file: a local font makes Next emit an extra
// render-blocking stylesheet chunk, which cost Lighthouse home.mobile and
// result.mobile more than the subset saved.
const titleScript = Pinyon_Script({
  variable: "--font-title-script",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

export const fontVariableClassNames = [
  fraunces.variable,
  instrumentSans.variable,
  ibmPlexMono.variable,
  ibmPlexMonoSecondary.variable,
  titleScript.variable,
].join(" ");
