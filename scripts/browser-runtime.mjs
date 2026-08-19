import { existsSync } from "node:fs";

const SYSTEM_CHROME_CANDIDATES = process.platform === "darwin"
  ? [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ]
  : process.platform === "win32"
    ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      ]
    : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];

export async function resolveChromeExecutable(serverlessChromium, env = process.env) {
  const configured = env.CHROME_PATH?.trim();
  const systemChromePath = [configured, ...SYSTEM_CHROME_CANDIDATES]
    .find((candidate) => Boolean(candidate) && existsSync(candidate));
  return {
    executablePath: systemChromePath || await serverlessChromium.executablePath(),
    usingSystemChrome: Boolean(systemChromePath),
  };
}
