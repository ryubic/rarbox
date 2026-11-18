# rarbox

A small Node.js script that archives folders with RAR using a fixed, archival-friendly configuration.

Run it inside a folder and it creates either:

- one archive for that folder, or
- with `-f`, one archive for each immediate subfolder.

## Requirements

- Node.js 20.19+ or 22.7+ (earlier versions can't run `rarbox.js` as an ES module unless a `package.json` with `"type": "module"` sits next to it)
- Git, to clone the repository
- RAR on the machine:
  - **Windows:** WinRAR installed at `C:\Program Files\WinRAR\Rar.exe`
  - **Linux/macOS:** the `rar` command available on your `PATH`

If RAR lives somewhere else, change `RAR_BINARY_PATH` at the top of `rarbox.js`.

## Installation

Clone the repository and put `rarbox` on your `PATH`, so you can run it from any folder.

### Windows

Add the cloned folder to your `PATH`. The included `rarbox.ps1` wrapper provides the `rarbox` command in PowerShell:

```powershell
node "$PSScriptRoot\rarbox.js" @args
```

If PowerShell blocks the script, run this once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

In `cmd.exe`, run `node <path-to>\rarbox.js` instead.

### Linux and macOS

Make the script executable and symlink it into a folder on your `PATH`:

```bash
chmod +x rarbox.js
sudo ln -s "$PWD/rarbox.js" /usr/local/bin/rarbox
```

The symlink points at the clone, so keep the clone where it is.

### Updating

Run `git pull` in the clone.

## Usage

Open a terminal **in the folder you want to archive** and run:

```
rarbox [-f] [-x]
```

| Option | Meaning                                                                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-f`   | Subfolders mode: create one archive per immediate subfolder of the current folder. Without it, the current folder is archived as a single archive. |
| `-x`   | Execute. Without it, rarbox only prints what it would do (dry run).                                                                                |

Always do a dry run first and check the list:

```
rarbox -f
rarbox -f -x
```

Examples:

```
# Archive the current folder as one archive
rarbox -x

# Archive every subfolder of the current folder separately
cd D:\Photos
rarbox -f -x
```

rarbox always works on the **current folder**. A path argument is ignored. If you haven't installed it, replace `rarbox` with `node path/to/rarbox.js`.

## Output

Each run creates a new timestamped folder, `rarbox-YYYYMMDD-HHMMSS`, using local time:

| Mode    | Output folder is created in      |
| ------- | -------------------------------- |
| `-f`    | the current folder               |
| default | the parent of the current folder |

In both cases the output folder is never inside a folder being archived. In `-f` mode, folders whose names start with `rarbox-` are skipped, so earlier runs are not archived again.

Archives are named after their source folder. A small archive is `name.rar`. A larger one is split into `name.part1.rar`, `name.part2.rar`, and so on. Keep all parts together.

Because the output is created next to the source, it is on the same drive. Make sure there is enough free space: roughly the size of the source plus 10% for the recovery record.

## RAR settings

| Switch    | Effect                                                              |
| --------- | ------------------------------------------------------------------- |
| `-cfg-`   | Ignore `rar.ini` and `RARINISWITCHES`, so only these settings apply |
| `-r`      | Recurse into subfolders                                             |
| `-idc`    | Hide the copyright banner (file names and progress are still shown) |
| `-m0`     | Store only, no compression                                          |
| `-v2000m` | 2000 MiB volumes (lowercase `m` means 1024×1024 bytes)              |
| `-rr10`   | 10% recovery record                                                 |
| `-htb`    | BLAKE2sp checksums instead of CRC32                                 |
| `-ams`    | Store the original archive name and creation time                   |
| `-k`      | Lock the archive against accidental modification by RAR             |
| `-t`      | Test the archive after creating it                                  |

To change them, edit `RAR_SWITCHES` at the top of `rarbox.js`.

## How it behaves

- RAR output is shown live, including progress. If RAR asks a question, you can answer it in the terminal.
- A failed folder does not stop the run. At the end, rarbox prints a summary and lists each failed folder with its reason.
- The exit code is `0` if everything succeeded and `1` if anything failed or the script could not start.
- If RAR cannot be launched, rarbox stops before creating the output folder.

## Things to know

- **Hidden folders are included in `-f` mode**, for example `.git`. Check the dry-run list.
- **On a drive root**, `-f` also lists system folders such as `$RECYCLE.BIN` and `System Volume Information`. Without `-f`, rarbox refuses to archive a drive root.
- **A failed archive can leave partial files** in the output folder, named like normal archives. Check the failure summary before trusting a run.
- **Unknown options are ignored.** Check the "Subfolders mode" line in the summary before running with `-x`.
