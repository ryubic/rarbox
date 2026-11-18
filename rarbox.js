#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { styleText } from "node:util";

const RAR_BINARY_PATH =
  process.platform === "win32" ? "C:\\Program Files\\WinRAR\\Rar.exe" : "rar";

const RAR_SWITCHES = [
  "-cfg-", // ignore rar.ini / RARINISWITCHES so ONLY these settings apply
  "-r", // recurse into subdirectories
  "-idc", // hide the copyright banner
  "-m0", // Store (no compression)
  "-v2000m", // volumes of 2000 MiB
  "-rr10", // 10% recovery record
  "-htb", // BLAKE2sp file checksums instead of CRC32
  "-ams", // store original archive name and creation time
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

function main() {
  const banner = `
┬─┐┌─┐┬─┐┌┐ ┌─┐─┐ ┬
├┬┘├─┤├┬┘├┴┐│ │┌┴┬┘
┴└─┴ ┴┴└─└─┘└─┘┴ └─
`;
  console.log(banner.trimStart());

  const cwd = path.resolve(".");

  const subfolderMode = process.argv.includes("-f");
  const execute = process.argv.includes("-x");

  if (!subfolderMode && path.basename(cwd) === "")
    throw new Error("Use -f at a drive root");

  const runRarIn = subfolderMode ? cwd : path.dirname(cwd);

  const outputDir = path.join(
    runRarIn,
    `rarbox-${new Date().toLocaleString("sv-SE").replace(/[-:]/g, "").replace(" ", "-")}`,
  ); // timestamped with local system time in YYYYMMDD-HHMMSS

  const dirsToRar = subfolderMode
    ? fs
        .readdirSync(cwd, { withFileTypes: true })
        .filter(
          (entry) => entry.isDirectory() && !entry.name.startsWith("rarbox-"),
        ) // keep only directories and omit previous output directories starting with "rarbox-"
        .map((entry) => path.join(cwd, entry.name)) // extract absolute paths
    : [cwd];

  if (dirsToRar.length === 0) throw new Error("No folders to archive");

  // Summary
  console.log(`Source directory         : ${cwd}`);
  console.log(`Output directory         : ${outputDir}`);
  console.log(`Subfolders mode          : ${subfolderMode}`);
  console.log(`RAR switches             : ${RAR_SWITCHES.join(" ")}`);
  console.log(`Directories to archive   : ${dirsToRar.length}`);
  dirsToRar.forEach((dir, index) => console.log(`    ${index + 1}. ${dir}`));

  if (!execute) {
    console.log(
      styleText("yellow", "\nDry run only. Re-run with -x to start archiving."),
    );
    return;
  }

  // check if rar exists
  const rarCheck = spawnSync(RAR_BINARY_PATH, ["-iver"]);
  if (rarCheck.error)
    throw new Error(
      `\nCannot execute RAR at "${RAR_BINARY_PATH}": ${rarCheck.error.message}`,
    );

  fs.mkdirSync(outputDir);

  // start archiving
  let passed = [];
  let failed = [];

  for (const [index, dir] of dirsToRar.entries()) {
    console.log(
      styleText(
        "cyan",
        `\n[${index + 1}/${dirsToRar.length}] Archiving ${dir}`,
      ),
    );

    const result = spawnSync(
      RAR_BINARY_PATH,
      [
        "a",
        ...RAR_SWITCHES,
        "--", // stop switches scanning
        path.join(outputDir, `${path.basename(dir)}.rar`),
        path.relative(runRarIn, dir),
      ],
      { cwd: runRarIn, stdio: "inherit" },
    );

    if (result.status === 0) {
      passed.push(dir);
      console.log(styleText("green", `Successfully archived ${dir}`));
    } else {
      console.log(styleText("red", `\nFailed to archive ${dir}`));

      let reason = "Unknown error";
      if (result.error) reason = result.error.message;
      else if (result.signal) reason = `Terminated by signal ${result.signal}`;
      else if (result.status !== null)
        reason = `exit code (${result.status}) - ${RAR_ERRORS[result.status] ?? "Unknown error"}`;

      failed.push({ dir, reason });
    }
  }

  console.log(`\n========================================`);
  const color = failed.length > 0 ? "red" : "green";
  console.log(
    styleText(
      color,
      `Complete! Success: ${passed.length} | Failed: ${failed.length}`,
    ),
  );

  if (failed.length > 0) {
    console.log(
      styleText("red", "\n=== Failed to archive the following folder(s) ==="),
    );

    failed.forEach((entity, index) => {
      console.log(
        styleText("red", `\n[${index + 1}/${failed.length}] ${entity.dir}`),
      );
      console.log(entity.reason.trim());
    });

    process.exitCode = 1;
  }
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
