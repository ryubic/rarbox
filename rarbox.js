import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parseArgs, styleText } from "node:util";
import { RAR_BINARY_PATH, OUTPUT_DIR, RAR_SWITCHES } from "./config.js";

async function main() {
  const banner = `┬─┐┌─┐┬─┐┌┐ ┌─┐─┐ ┬                
├┬┘├─┤├┬┘├┴┐│ │┌┴┬┘
┴└─┴ ┴┴└─└─┘└─┘┴ └─
`;
  console.log(styleText("magenta", banner));

  // parse args
  let args;
  try {
    args = parseArgs({
      allowPositionals: true,
      options: {
        help: { type: "boolean", short: "h", default: false },
        "subfolder-mode": { type: "boolean", short: "f", default: false },
      },
    });
  } catch (error) {
    throw new Error("Failed to parse arguments", { cause: error });
  }

  if (args.values.help) {
    console.log(`Usage:
  node rarbox.js [options] <directory>

Arguments:
  <directory>             Source directory (must not be a drive root and must
                          not contain the output directory)

Options:
  -f, --subfolder-mode    Archive each immediate subfolder of <directory> as its
                          own archive, instead of archiving <directory> itself.
                          Files directly inside <directory> are not archived.
  -h, --help              Show this help and exit

Examples:
  node rarbox.js D:\\Photos\\2024   Archive the 2024 folder as one archive
  node rarbox.js -f D:\\Photos     Archive each subfolder of Photos separately`);

    return;
  }

  // check if rar is available
  const checkRar = spawnSync(RAR_BINARY_PATH, ["-iver"]);

  if (checkRar.status !== 0 || checkRar.error?.code === "ENOENT")
    throw new Error(
      `Could not run RAR at "${RAR_BINARY_PATH}". Check RAR_BINARY_PATH in config.js.`,
      { cause: checkRar.error },
    );

  if (args.positionals.length !== 1)
    throw new Error("Please enter only options and a single directory path");

  const sourceDir = path.resolve(args.positionals[0]);

  // check if provided source directory is valid
  let sourceDirStat;
  try {
    sourceDirStat = fs.statSync(sourceDir);
  } catch (error) {
    throw new Error("Source directory path is invalid", { cause: error });
  }

  if (!sourceDirStat.isDirectory())
    throw new Error("Source directory is not a directory");

  if (path.parse(sourceDir).root === sourceDir)
    throw new Error("Source directory must not be a drive root");

  // check if OUTPUT_DIR is in sourceDir
  const rel = path.relative(sourceDir, OUTPUT_DIR);
  if (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel))
  )
    throw new Error("OUTPUT_DIR should not be or be inside source directory");

  const runRarIn = args.values["subfolder-mode"]
    ? sourceDir
    : path.dirname(sourceDir);

  const dirsToRar = args.values["subfolder-mode"]
    ? fs
        .readdirSync(sourceDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory()) // keep only directories
        .map((entry) => path.join(sourceDir, entry.name)) // extract absolute paths
        .sort((a, b) => a.localeCompare(b)) // sort alphabetically (case-insensitive safe)
    : [sourceDir];

  if (dirsToRar.length === 0) throw new Error("No folders to archive");

  const outputDir = path.join(
    path.resolve(OUTPUT_DIR),
    `${path.basename(sourceDir)}-${randomBytes(4).toString("hex")}`,
  );

  // ask user if they want to proceed, return early if they don't
  console.log(`Source directory         : ${sourceDir}`);
  console.log(`Save archives in         : ${outputDir}`);
  console.log(`Subfolders mode          : ${args.values["subfolder-mode"]}`);
  console.log(`RAR switches             : ${RAR_SWITCHES.join(" ")}`);
  console.log(`Directories to archive   : ${dirsToRar.length}`);
  dirsToRar.forEach((dir, index) => console.log(`    ${index + 1}. ${dir}`));

  // ask for confirmation before proceeding
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const userResponse = await rl.question(`\nProceed? (y/n): `);
  rl.close();

  if (userResponse.trim().toLowerCase() !== "y") {
    console.log("\nCancelled. No archives were created.");
    return;
  } else console.log("\nCreating archives...");

  // create output directory recursively
  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create ${outputDir}`, { cause: error });
  }

  // start archiving
  const done = [];
  const failed = [];

  for (const dir of dirsToRar) {
    const tempDir = path.join(
      path.resolve(OUTPUT_DIR),
      ".rarbox-temp",
      randomUUID(),
    );

    // create temp directory recursively
    try {
      fs.mkdirSync(tempDir, { recursive: true });
    } catch (error) {
      console.error(
        `[FAILURE] ${dir}\nFailed to create ${tempDir}: ${error.message}\n`,
      );
      failed.push(dir);
      continue;
    }

    const archive = path.join(tempDir, `${path.basename(dir)}.rar`);

    const runRar = spawnSync(
      RAR_BINARY_PATH,
      [
        "a",
        ...RAR_SWITCHES,
        "--", // stop switches scanning
        archive,
        path.relative(runRarIn, dir),
      ],
      { cwd: runRarIn, stdio: "inherit" },
    );

    let success = !runRar.error && runRar.status === 0;
    let reason;

    if (success) {
      try {
        // move archives to output directory
        for (const file of fs.readdirSync(tempDir)) {
          fs.renameSync(path.join(tempDir, file), path.join(outputDir, file));
        }
      } catch (error) {
        success = false;
        reason = `Failed to move archive into place: ${error.message}`;
      }
    } else {
      reason =
        runRar.error?.message ??
        (runRar.signal
          ? `RAR was terminated by signal ${runRar.signal}`
          : `RAR exited with code ${runRar.status}`);
    }

    if (success) {
      console.log(styleText("green", `[+] ${dir}`));
      done.push(dir);
    } else {
      console.error(styleText("red", `[-] ${dir}\n${reason}`));
      failed.push(dir);
    }

    // delete temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to remove temp directory: ${error.message}`);
    }
  }

  return { dirsToRar, done, failed };
}

main()
  .then((result) => {
    if (!result) return;
    const { dirsToRar, done, failed } = result;
    if (dirsToRar.length === done.length) {
      console.log(styleText("green", "\n--- All Done! ---"));
      process.exit(0);
    } else {
      console.error(
        styleText(
          "red",
          `\n--- Failed to create ${failed.length}/${dirsToRar.length} archives ---`,
        ),
      );
      failed.forEach((dir, index) => console.error(`    ${index + 1}. ${dir}`));
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(err.message);
    if (err.cause) console.error("Caused by:", err.cause.message ?? err.cause);
    process.exit(1);
  });
