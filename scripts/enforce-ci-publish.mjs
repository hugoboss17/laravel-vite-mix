const inGithubActions = process.env.GITHUB_ACTIONS === "true";

if (!inGithubActions) {
  console.error("prepublishOnly failed: publishing is restricted to GitHub Actions CI.");
  process.exit(1);
}

console.log("prepublishOnly passed (GitHub Actions environment detected).");
