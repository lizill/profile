import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_ENV_KEY = "STATICRYPT_PASSWORD";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const templatePath = path.join(rootDir, "scripts", "staticrypt-template.html");

async function main(): Promise<void> {
  await loadDotEnvFile(path.join(rootDir, ".env"));

  const password = process.env[REQUIRED_ENV_KEY]?.trim();

  if (!password) {
    throw new Error(`${REQUIRED_ENV_KEY} が設定されていません。.env または環境変数に短い合言葉を設定してください。`);
  }

  process.env[REQUIRED_ENV_KEY] = password;

  if (!existsSync(distDir)) {
    throw new Error("dist が見つかりません。先に pnpm build を実行してください。");
  }

  if (!existsSync(templatePath)) {
    throw new Error("StatiCrypt のテンプレートが見つかりません。");
  }

  const entries = await readdir(distDir);

  if (entries.length === 0) {
    throw new Error("dist が空です。先に pnpm build を実行してください。");
  }

  await runStaticrypt(entries.map((entry) => path.join(distDir, entry)));
}

async function loadDotEnvFile(filePath: string): Promise<void> {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = await readFile(filePath, "utf8");

  contents.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);

    if (!match) {
      return;
    }

    const [, key, rawValue = ""] = match;

    if (!key || key.startsWith("#") || process.env[key] !== undefined) {
      return;
    }

    process.env[key] = parseEnvValue(rawValue);
  });
}

function parseEnvValue(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if ((quote === "\"" || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  const commentIndex = trimmed.indexOf(" #");
  return commentIndex >= 0 ? trimmed.slice(0, commentIndex).trim() : trimmed;
}

function runStaticrypt(inputPaths: string[]): Promise<void> {
  const command = process.platform === "win32" ? "staticrypt.cmd" : "staticrypt";
  const args = [
    ...inputPaths,
    "--recursive",
    "--directory",
    distDir,
    "--config",
    "false",
    "--template",
    templatePath,
    "--short",
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`staticrypt が失敗しました。code=${code ?? "null"} signal=${signal ?? "null"}`));
    });
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
