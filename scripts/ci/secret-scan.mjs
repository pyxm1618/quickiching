import { execFileSync } from "node:child_process";

const base = process.env.CI_BASE_SHA;
if (!base || /^0+$/.test(base)) {
  console.log("No usable base SHA; secret scan has no PR diff to inspect.");
  process.exit(0);
}
const diff = execFileSync("git", ["diff", "--unified=0", `${base}...HEAD`, "--", ":!bun.lock"], { encoding: "utf8" });
const added = diff.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).map((line) => line.slice(1)).join("\n");
const patterns = new Map([
  ["private_key_pem", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["credentialed_database_url", /postgres(?:ql)?:\/\/[^\s/:]+:[^\s/@]+@/i],
  ["github_token", /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/],
  ["live_provider_token", /\b(?:sk_live|pk_live)_[A-Za-z0-9_-]{16,}\b/],
  ["literal_private_key_assignment", /^(?:\s*)(?:WAFFO_PRIVATE_KEY|REFUND_OPERATOR_SECRET|BETTER_AUTH_SECRET|APP_SECRET)\s*=\s*[^\s#].*$/m],
  ["public_secret_env", /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE_KEY|DATABASE_URL)\b/],
]);
const hits = [...patterns].filter(([, pattern]) => pattern.test(added)).map(([name]) => name);
if (hits.length) {
  throw new Error(`Potential plaintext secret patterns found in changed lines: ${hits.join(", ")}`);
}
console.log("Plaintext secret scan passed.");
