#!/usr/bin/env node

const RAR_BINARY_PATH =
  process.platform === "win32" ? "C:\\Program Files\\WinRAR\\Rar.exe" : "rar";

const RAR_SWITCHES = [
  "-cfg-", // ignore rar.ini / RARINISWITCHES so ONLY these settings apply
  "-r", // recurse into subdirectories to ensure present into the target folder gets added into the archive
  "-idq", // run rar in quiet mode, so only error messages and questions are displayed
  "-m0", // Store (no compression)
  "-v2000m", // volumes of 2000 MB. Lowercase m = 1024*1024 bytes (2000 MiB), uppercase M would be 1,000,000 bytes (2,000,000,000 total)
  "-rr10", // recovery record, 10% of archive size (RAR5: value is a percent)
  "-htb", // BLAKE2sp file checksums instead of CRC32
  "-ams", // store original archive name and creation time
  "-tsm+", // store modification time, maximum precision
  "-tsc+", // store creation time (ctime on Unix), maximum precision
  "-k", // lock archive (protects against accidental modification by RAR only)
  "-t", // test files after archiving
];

const RAR_ERRORS = {
  1: "Non-fatal error(s) occurred.",
  2: "A fatal error occurred.",
  3: "Invalid checksum. Data is damaged.",
  4: "Attempt to modify an archive locked by 'k' command.",
  5: "Write error.",
  6: "File open error.",
  7: "Wrong command line option.",
  8: "Not enough memory.",
  9: "File create error.",
  10: "No files matching the specified mask and options were found.",
  11: "Wrong password.",
  12: "Read error.",
  13: "Bad archive.",
  255: "User stopped the process.",
};

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { styleText } from "node:util";
import readline from "node:readline/promises";

async function main() {
  // print banner
  const banner = `┬─┐┌─┐┬─┐┌┐ ┌─┐─┐ ┬                
├┬┘├─┤├┬┘├┴┐│ │┌┴┬┘
┴└─┴ ┴┴└─└─┘└─┘┴ └─
`;
  console.log(banner);

  // parse args
  const args = process.argv.slice(2);
  const subfolderMode = args.includes("-f");
  const targetPath = args.find((arg) => !arg.startsWith("-")) || ".";

  const sourceDir = path.resolve(targetPath);

  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory())
    throw new Error("Please provide path of a valid folder to archive");

  if (!subfolderMode && path.parse(sourceDir).root === sourceDir)
    throw new Error(
      "Refusing to archive a drive root as a single archive. Use -f to archive its subfolders.",
    );

  const runRarIn = subfolderMode ? sourceDir : path.dirname(sourceDir);

  const dirsToRar = subfolderMode
    ? fs
        .readdirSync(sourceDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory()) // keep only directories
        .map((entry) => path.join(sourceDir, entry.name)) // extract absolute paths
    : [sourceDir];

  if (dirsToRar.length === 0) throw new Error("No folders to archive");

  // check if rar exists
  const rarCheck = spawnSync(RAR_BINARY_PATH, ["-iver"]);
  if (rarCheck.error?.code === "ENOENT")
    throw new Error(
      `RAR not found at "${RAR_BINARY_PATH}". On Windows, install WinRAR. On Linux/macOS, install the RAR CLI tools and make sure they're on your PATH.`,
    );

  // Summary
  console.log(`Source directory         : ${sourceDir}`);
  console.log(`Save archives in         : ${runRarIn}`);
  const modeLabel = subfolderMode
    ? styleText("green", "ON (one archive per subfolder)")
    : styleText("yellow", "OFF (one archive for the whole folder)");
  console.log(`Subfolders mode          : ${modeLabel}`);
  console.log(`RAR switches             : ${RAR_SWITCHES.join(" ")}`);
  console.log(`Directories to archive   : ${dirsToRar.length}`);
  dirsToRar.forEach((dir, index) => console.log(`    ${index + 1}. ${dir}`));

  // ask for confirmation before proceeding
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const userResponse = await rl.question(`\nProceed? (y/N): `);
  rl.close();

  if (userResponse.trim().toLowerCase() !== "y") {
    console.log("Cancelled. Nothing was archived.");
    return;
  }

  // start archiving
  let passed = 0;
  let failed = 0;

  for (const [index, dir] of dirsToRar.entries()) {
    const result = spawnSync(
      RAR_BINARY_PATH,
      [
        "a",
        ...RAR_SWITCHES,
        "--", // stop switches scanning
        `${path.basename(dir)}.rar`,
        path.relative(runRarIn, dir),
      ],
      { cwd: runRarIn, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
    );

    if (result.status === 0) {
      passed++;

      console.log(
        styleText(
          "green",
          `[${index + 1}/${dirsToRar.length}] [+] Successfully archived ${dir}`,
        ),
      );
    } else {
      console.log(
        styleText(
          "red",
          `[${index + 1}/${dirsToRar.length}] [-] Failed to archive ${dir}`,
        ),
      );

      let reason = "Unknown error";
      if (result.error) reason = result.error.message;
      else if (result.signal) reason = `Terminated by signal ${result.signal}`;
      else if (result.status !== null)
        reason = `exit code (${result.status}) - ${RAR_ERRORS[result.status] ?? "Unknown error"}`;

      console.log(`${styleText("red", "reason :")} ${reason}`);

      const stdout = result.stdout?.trim();
      const stderr = result.stderr?.trim();
      if (stdout) console.log(`${styleText("red", "stdout :")} ${stdout}`);
      if (stderr) console.log(`${styleText("red", "stderr :")} ${stderr}`);

      failed++;
    }
  }

  console.log(`========================================`);
  const color = failed > 0 ? "red" : "green";
  console.log(
    styleText(color, `Complete! Success: ${passed} | Failed: ${failed}`),
  );

  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
