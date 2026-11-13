# rarbox

A small Node.js script that batch-creates RAR archives with the RAR command line tool. Run it inside a folder to archive that folder, or with `-f` to archive each subfolder as its own archive.

## Requirements

- **Node.js 20.12 or newer**
- **RAR command line tool**
  - Windows: WinRAR, with `Rar.exe` at `C:\Program Files\WinRAR\Rar.exe`
  - Linux/macOS: the `rar` binary on your `PATH`

## Install

```sh
git clone https://github.com/ryubic/rarbox.git
```

**Windows:** add the cloned folder to your `PATH`, then run `rarbox` in PowerShell.

**Linux/macOS:** run `chmod +x rarbox.js`, then link it onto your `PATH`:

```sh
ln -s "$(pwd)/rarbox.js" ~/.local/bin/rarbox
```

Update with `git pull`.

## Usage

```
rarbox [-f] [directory]
```

| Argument    | Meaning                                                                             |
| ----------- | ----------------------------------------------------------------------------------- |
| `directory` | Folder to archive. Defaults to the current directory.                               |
| `-f`        | Subfolder mode: archive each immediate subfolder of `directory` as its own archive. |

Examples:

```
# Archive the current folder as one archive
rarbox

# Archive each subfolder of the current folder separately
rarbox -f

# Archive a specific folder
rarbox D:\Photos\2024

# Archive each subfolder of a specific folder
rarbox D:\Photos -f
```

Before anything is archived, rarbox prints a summary (source, where archives will be saved, mode, the RAR switches in use, and the list of folders) and asks `Proceed? (y/N)`. Only `y` continues. Anything else cancels without creating any files.

## Where archives are saved

RAR writes the archives directly, with no temp folder or separate output directory.

| Mode             | Archives are saved in              | Example                                                          |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------- |
| Single (default) | The **parent** of the folder       | `D:\Photos\2024` is archived into `D:\Photos`                    |
| `-f`             | **Inside** the folder you point at | `D:\Photos` with subfolder `2024` is archived into `D:\Photos`   |

Archives are named after the folder. Depending on your switches, a folder produces `2024.rar`, or a set of volumes such as `2024.part1.rar`, `2024.part2.rar` (see [Configuration](#configuration)).

In `-f` mode, files that sit directly inside the folder (not in a subfolder) are not archived.

## Configuration

Settings are constants at the top of `rarbox.js`. Edit them to suit your setup.

### `RAR_BINARY_PATH`

Where the RAR executable is. Defaults to the standard WinRAR path on Windows and `rar` (from your `PATH`) elsewhere. Change it if RAR is installed somewhere else.

### `RAR_SWITCHES`

The list of switches passed to `rar a`. The defaults are made for backups, not for saving space:

| Switch          | Effect                                                              |
| --------------- | ------------------------------------------------------------------- |
| `-cfg-`         | Ignore `rar.ini` and `RARINISWITCHES`, so only these settings apply |
| `-r`            | Recurse into subfolders                                             |
| `-idq`          | Quiet mode, only errors are shown                                   |
| `-m0`           | Store only, no compression                                          |
| `-v2000m`       | Split into 2000 MiB volumes                                         |
| `-rr10`         | 10% recovery record                                                 |
| `-htb`          | BLAKE2sp checksums                                                  |
| `-ams`          | Store original archive name and creation time                       |
| `-tsm+` `-tsc+` | Store modification and creation times at maximum precision          |
| `-k`            | Lock the archive against accidental modification by RAR             |
| `-t`            | Test files after archiving                                          |

Some behavior depends on these switches, so keep it in mind when you change them:

- **Volumes (`-v`).** Without it, each folder produces a single `.rar`. With it, archives larger than the volume size are split into numbered parts.
- **Compression (`-m`).** `-m0` stores files as-is, which is fast but makes archives as large as the source. Use `-m3` or `-m5` for normal compression.
- **Testing (`-t`).** Verifying the archive takes time, so there can be a long silence after RAR finishes writing. Remove it for faster runs.
- **Quiet mode (`-idq`).** rarbox captures RAR's output and prints it only when an archive fails, so you won't see live progress either way.
- **Archive name and folder.** rarbox adds these itself. Don't put them in the switch list.

The switches in use are always shown in the summary before the prompt, so you can confirm your changes took effect.

## What it checks

rarbox exits with an error (exit code 1) if:

- the path does not exist or is not a folder
- the path is a drive root in single mode (use `-f` to archive a drive's subfolders)
- `-f` is used and the folder has no subfolders
- RAR cannot be found at `RAR_BINARY_PATH`

If an individual archive fails, rarbox prints the reason (RAR exit code and meaning, signal, or spawn error, plus any RAR output), continues with the rest, and reports a final count.

## Exit codes

| Code | Meaning                                              |
| ---- | ---------------------------------------------------- |
| `0`  | All archives created, or you cancelled at the prompt |
| `1`  | A check failed, or at least one archive failed       |

## Known limitations

- **Re-running over existing archives.** RAR adds to an archive with the same name, and `-k` locks it. Running again where the archive already exists can fail with error 4 or mix old and new files. Delete the old `Name*.rar` files first.
- **Failed runs leave partial files.** RAR writes directly to the destination, so a run that fails midway can leave incomplete archives. Delete them before retrying.
- **RAR warnings count as failures.** Exit code 1 (non-fatal warnings) is reported as a failed archive.
- **Flags are exact.** Only `-f` is recognized. Variants like `-F` or `--subfolder` are ignored and the run falls back to single mode, which is why the mode is spelled out in the summary before the prompt.
- **Only one path is used.** If you pass several paths, only the first is used.
- **`~` is not expanded in PowerShell.** Use `$HOME` or the full path instead.
- **Execution policy on Windows.** If PowerShell refuses to run `rarbox.ps1`, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.