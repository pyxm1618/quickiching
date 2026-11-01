import { Noto_Serif_SC } from "next/font/google";
import { fontVariableClassNames } from "./fonts";

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-sc",
  weight: "variable",
  display: "swap",
  preload: false,
});

export const localizedFontVariableClassNames = [
  fontVariableClassNames,
  notoSerifSC.variable,
].join(" ");
