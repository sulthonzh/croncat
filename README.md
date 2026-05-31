# croncat

> Crontab helper — pretty-print, validate, and detect conflicts in cron schedules.

## Why

Reading raw crontab files is painful. `0 2 * * mon-fri /usr/bin/backup.sh` — what does that even mean? And finding conflicting schedules across 20 entries? Good luck.

croncat makes crontabs readable and safe. It translates schedules to plain English, validates entries, detects overlaps, and shows upcoming runs.

## Install

```bash
npm install -g croncat
```

## Usage

```bash
# Pretty-print a crontab file
croncat /etc/crontab

# Read from stdin
crontab -l | croncat -

# Human-readable descriptions only
croncat --describe crontab.txt
# → at minute 30, 4:00  →  /opt/daily.sh
# → every 15 minutes  →  /usr/bin/healthcheck

# Validate a crontab (exits 1 on errors)
croncat --validate my-crontab

# Detect overlapping schedules
croncat --conflicts crontab.txt

# Show next 5 run times for each entry
croncat --next crontab.txt

# JSON output (great for scripts and CI)
croncat --json crontab.txt
```

## Output Example

```
$ croncat crontab.txt

Schedule        Command                                     Description
------------    ---------------------------------------     ---------------------------
0 2 * * *       /usr/bin/backup.sh                          at minute 0, 2:00
*/15 * * * *    /usr/bin/healthcheck                        every 15 minutes
0 9-17 * * mon  node report.js                              on Monday, 9:00, 10:00, ... 17:00 (9 values), at minute 0
@hourly         /usr/bin/ping                               every minute
```

## What It Handles

- **Standard cron syntax**: 5 fields (minute hour day-of-month month day-of-week) + command
- **@shortcuts**: `@hourly`, `@daily`, `@weekly`, `@monthly`, `@yearly`, `@annually`, `@midnight`
- **Ranges**: `9-17`, `mon-fri`
- **Steps**: `*/15`, `0-23/2`, `10/20`
- **Lists**: `0,15,30,45`
- **Day/month names**: `mon`, `tue`, `jan`, `feb` (3-letter or full)
- **Conflict detection**: flags entries that run at the same time
- **Next run calculation**: shows upcoming executions for each entry
- **Validation**: catches out-of-range values, malformed entries, unknown @periods

## Programmatic API

```typescript
import { parseCrontab, detectConflicts, getNextRuns } from 'croncat';

const { entries, errors } = parseCrontab(`
0 2 * * * /usr/bin/backup.sh
*/15 * * * * /usr/bin/healthcheck
`);

for (const entry of entries) {
  console.log(entry.description);  // "at minute 0, 2:00"
  console.log(entry.fields.minute); // [0]
  const runs = getNextRuns(entry, 5);
}

const conflicts = detectConflicts(entries);
```

## License

MIT
