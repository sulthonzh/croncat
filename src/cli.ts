#!/usr/bin/env node
import { parseCrontab, detectConflicts, formatTable, formatJSON, getNextRuns } from './parser.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function usage() {
  console.log(`croncat — crontab pretty-printer, validator, and conflict detector

Usage:
  croncat <file>              Parse and pretty-print a crontab file
  croncat -                    Read from stdin
  croncat --validate <file>    Validate only (exit 1 on errors)
  croncat --conflicts <file>   Detect schedule conflicts
  croncat --next <file>        Show next 5 run times for each entry
  croncat --json <file>        JSON output
  croncat --describe <file>    Human-readable descriptions only

Examples:
  croncat /etc/crontab
  crontab -l | croncat -
  croncat --validate my-crontab
  croncat --json crontab.txt
  croncat --next crontab.txt
`);
}

function readInput(file: string): string {
  if (file === '-') {
    return readFileSync(0, 'utf-8');
  }
  return readFileSync(resolve(file), 'utf-8');
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}

let mode = 'table';
let file = '';

for (const arg of args) {
  if (arg === '--validate') mode = 'validate';
  else if (arg === '--conflicts') mode = 'conflicts';
  else if (arg === '--next') mode = 'next';
  else if (arg === '--json') mode = 'json';
  else if (arg === '--describe') mode = 'describe';
  else file = arg;
}

if (!file) {
  console.error('Error: no file specified. Use - for stdin.');
  process.exit(1);
}

try {
  const content = readInput(file);
  const { entries, errors } = parseCrontab(content);

  switch (mode) {
    case 'validate': {
      if (errors.length > 0) {
        for (const e of errors) {
          console.error(`Line ${e.lineIndex + 1}: ${e.message}`);
          console.error(`  ${e.raw}`);
        }
        process.exit(1);
      }
      console.log(`✓ ${entries.length} valid entries, no errors`);
      break;
    }

    case 'conflicts': {
      const conflicts = detectConflicts(entries);
      if (conflicts.length === 0) {
        console.log('No schedule conflicts detected');
      } else {
        for (const c of conflicts) {
          console.log(`Conflict: ${c.reason}`);
          const e1 = entries.find(e => e.lineIndex === c.entry1);
          const e2 = entries.find(e => e.lineIndex === c.entry2);
          if (e1) console.log(`  Line ${c.entry1 + 1}: ${e1.raw}`);
          if (e2) console.log(`  Line ${c.entry2 + 1}: ${e2.raw}`);
        }
      }
      break;
    }

    case 'next': {
      for (const entry of entries) {
        console.log(`\n${entry.raw}`);
        console.log(`  ${entry.description}`);
        const runs = getNextRuns(entry, 5);
        for (const r of runs) {
          console.log(`  → ${r.toISOString()}`);
        }
      }
      break;
    }

    case 'json': {
      const conflicts = detectConflicts(entries);
      console.log(JSON.stringify(formatJSON(entries, errors, conflicts), null, 2));
      break;
    }

    case 'describe': {
      for (const entry of entries) {
        console.log(`${entry.description}  →  ${entry.command}`);
      }
      break;
    }

    default: {
      if (entries.length > 0) {
        console.log(formatTable(entries));
        console.log('');
      }
      if (errors.length > 0) {
        console.error(`\n⚠ ${errors.length} error(s):`);
        for (const e of errors) {
          console.error(`  Line ${e.lineIndex + 1}: ${e.message}`);
        }
      }
      const conflicts = detectConflicts(entries);
      if (conflicts.length > 0) {
        console.log(`\n⚠ ${conflicts.length} conflict(s) detected:`);
        for (const c of conflicts) {
          console.log(`  ${c.reason}`);
        }
      }
    }
  }
} catch (err: any) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
