import { spawn } from "node:child_process";
import { resolveVercelBuildPlan } from "../src/server/release/vercel-build-plan";

for (const step of resolveVercelBuildPlan()) {
  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn("bun", ["run", step], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
