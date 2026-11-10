import os from "node:os";
import path from "node:path";

export const RAR_BINARY_PATH = "C:\\Program Files\\WinRAR\\Rar.exe";
export const OUTPUT_DIR = path.join(os.homedir(), "rarbox");

export const RAR_SWITCHES = [
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
