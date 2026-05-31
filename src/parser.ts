/**
 * croncat — Crontab parser, validator, and human-readable printer.
 */

export interface CronField {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

export interface ParsedEntry {
  schedule: string;
  fields: CronField;
  command: string;
  /** Human-readable description of the schedule. */
  description: string;
  /** The original raw line. */
  raw: string;
  /** 0-based index in the source. */
  lineIndex: number;
}

// ── Constants ────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const DAY_ABBR: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};
const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const RANGES: [number, number][] = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6],  // day of week
];

// ── Parse helpers ────────────────────────────────────────────────────────

function resolveAlias(token: string, fieldIndex: number): string {
  const lower = token.toLowerCase();
  if (fieldIndex === 4) {
    // day of week — accept 3-letter or full names
    for (const [abbr, num] of Object.entries(DAY_ABBR)) {
      if (lower.startsWith(abbr)) return String(num);
    }
    // Also try full names
    const idx = DAY_NAMES.findIndex(d => d.toLowerCase().startsWith(lower));
    if (idx >= 0) return String(idx);
  }
  if (fieldIndex === 3) {
    for (const [abbr, num] of Object.entries(MONTH_ABBR)) {
      if (lower.startsWith(abbr)) return String(num);
    }
    const idx = MONTH_NAMES.findIndex((m, i) => i > 0 && m.toLowerCase().startsWith(lower));
    if (idx > 0) return String(idx);
  }
  return token;
}

/** Resolve a single token (possibly a range like "mon-fri") to numeric string(s). */
function resolveToken(token: string, fieldIndex: number): string {
  const lower = token.toLowerCase();

  // Try alias-aware range: mon-fri, jan-mar
  const rangeParts = lower.split('-');
  if (rangeParts.length === 2) {
    const a = resolveAlias(rangeParts[0], fieldIndex);
    const b = resolveAlias(rangeParts[1], fieldIndex);
    // If both resolved to numbers, it's a range
    if (!isNaN(Number(a)) && !isNaN(Number(b))) {
      return `${a}-${b}`;
    }
  }

  return resolveAlias(token, fieldIndex);
}

function expandField(field: string, fieldIndex: number): number[] {
  const [min, max] = RANGES[fieldIndex];
  if (field === '*' || field === '?') {
    const values: number[] = [];
    for (let i = min; i <= max; i++) values.push(i);
    return values;
  }

  // Handle comma-separated parts
  const parts = field.split(',');
  const result = new Set<number>();

  for (const part of parts) {
    const resolved = resolveToken(part.trim(), fieldIndex);

    // step: */N or A-B/N or N/N
    const stepMatch = resolved.match(/^(.+?)\/(\d+)$/);
    if (stepMatch) {
      const [, range, stepStr] = stepMatch;
      const step = parseInt(stepStr, 10);
      let start = min;
      let end = max;
      if (range !== '*') {
        if (range.includes('-')) {
          const [a, b] = range.split('-').map(Number);
          start = a;
          end = b;
        } else {
          // N/M means start at N, step by M, until max
          start = parseInt(range, 10);
        }
      }
      for (let i = start; i <= end; i += step) result.add(i);
      continue;
    }

    // range: A-B
    const rangeMatch = resolved.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const [, a, b] = rangeMatch;
      for (let i = parseInt(a, 10); i <= parseInt(b, 10); i++) result.add(i);
      continue;
    }

    // single value
    const n = parseInt(resolved, 10);
    if (isNaN(n)) throw new Error(`Invalid field value: "${part}"`);
    result.add(n);
  }

  return [...result].sort((a, b) => a - b);
}

// ── Validate ─────────────────────────────────────────────────────────────

export interface ValidationError {
  lineIndex: number;
  raw: string;
  message: string;
}

function validateField(values: number[], fieldIndex: number): string | null {
  const [min, max] = RANGES[fieldIndex];
  for (const v of values) {
    if (v < min || v > max) {
      const names = ['minute', 'hour', 'day of month', 'month', 'day of week'];
      return `${names[fieldIndex]} value ${v} out of range (${min}-${max})`;
    }
  }
  return null;
}

// ── Human-readable description ───────────────────────────────────────────

function describe(values: number[], fieldIndex: number): string {
  const names = ['minute', 'hour', 'day of month', 'month', 'day of week'];
  const [min, max] = RANGES[fieldIndex];
  const isAll = values.length === max - min + 1 &&
    values[0] === min && values[values.length - 1] === max;

  if (isAll) return '';

  // Detect step patterns
  if (values.length >= 2) {
    const step = values[1] - values[0];
    if (values.every((v, i) => i === 0 || v - values[i - 1] === step)) {
      if (fieldIndex === 0) return `every ${step} minutes`;
      if (fieldIndex === 1) return `every ${step} hours`;
    }
  }

  const fmt = (n: number) => {
    if (fieldIndex === 3) return MONTH_NAMES[n];
    if (fieldIndex === 4) return DAY_NAMES[n];
    if (fieldIndex === 1) return `${n}:00`;
    return String(n);
  };

  if (values.length === 1) return fmt(values[0]);

  const strs = values.map(fmt);
  if (strs.length <= 3) return strs.join(', ');
  return `${strs[0]}, ${strs[1]}, ... ${strs[strs.length - 1]} (${values.length} values)`;
}

function describeEntry(fields: CronField): string {
  const parts: string[] = [];

  const dow = describe(fields.dayOfWeek, 4);
  const mon = describe(fields.month, 3);
  const dom = describe(fields.dayOfMonth, 2);
  const hr = describe(fields.hour, 1);
  const min = describe(fields.minute, 0);

  if (dow) parts.push(`on ${dow}`);
  if (mon) parts.push(`in ${mon}`);
  if (dom) parts.push(`on day ${dom}`);
  if (hr) parts.push(hr);
  if (min) parts.push(`at minute ${min}`);

  if (parts.length === 0) return 'every minute';

  // Reorder: month, day-of-month, day-of-week, hour, minute
  const ordered: string[] = [];
  const m = parts.find(p => p.startsWith('in '));
  if (m) ordered.push(m);
  const d = parts.find(p => p.startsWith('on day '));
  if (d) ordered.push(d);
  const w = parts.find(p => p.startsWith('on ') && !p.startsWith('on day '));
  if (w) ordered.push(w);
  const h = parts.find(p => /^\d/.test(p) && p.includes(':'));
  if (h) ordered.push(h);
  const mi = parts.find(p => p.startsWith('at minute '));
  if (mi) ordered.push(mi);
  const rem = parts.filter(p => !ordered.includes(p));
  ordered.push(...rem);

  return ordered.join(', ');
}

// ── Conflict detection ───────────────────────────────────────────────────

export interface Conflict {
  entry1: number; // line index
  entry2: number;
  reason: string;
}

function setsOverlap(a: number[], b: number[]): boolean {
  const setB = new Set(b);
  return a.some(v => setB.has(v));
}

export function detectConflicts(entries: ParsedEntry[]): Conflict[] {
  const conflicts: Conflict[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i].fields;
      const b = entries[j].fields;

      const minuteOverlap = setsOverlap(a.minute, b.minute);
      const hourOverlap = setsOverlap(a.hour, b.hour);
      const domOverlap = setsOverlap(a.dayOfMonth, b.dayOfMonth);
      const monthOverlap = setsOverlap(a.month, b.month);
      const dowOverlap = setsOverlap(a.dayOfWeek, b.dayOfWeek);

      if (minuteOverlap && hourOverlap && domOverlap && monthOverlap && dowOverlap) {
        conflicts.push({
          entry1: entries[i].lineIndex,
          entry2: entries[j].lineIndex,
          reason: `Schedules overlap — both run at the same time (lines ${entries[i].lineIndex + 1} & ${entries[j].lineIndex + 1})`,
        });
      }
    }
  }

  return conflicts;
}

// ── Parse full crontab ──────────────────────────────────────────────────

export function parseCrontab(content: string): {
  entries: ParsedEntry[];
  errors: ValidationError[];
} {
  const lines = content.split('\n');
  const entries: ParsedEntry[] = [];
  const errors: ValidationError[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const raw = lines[lineIndex].trim();

    // Skip empty lines, comments, env vars
    if (!raw || raw.startsWith('#')) continue;
    if (raw.includes('=') && !raw.match(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+/)) continue;

    // Special entries (@hourly, @daily, etc.)
    const specialMatch = raw.match(/^@(\w+)\s+(.+)$/);
    if (specialMatch) {
      const [, period, command] = specialMatch;
      const specialSchedules: Record<string, string> = {
        yearly: '0 0 1 1 *',
        annually: '0 0 1 1 *',
        monthly: '0 0 1 * *',
        weekly: '0 0 * * 0',
        daily: '0 0 * * *',
        midnight: '0 0 * * *',
        hourly: '0 * * * *',
      };
      const schedule = specialSchedules[period.toLowerCase()];
      if (!schedule) {
        errors.push({ lineIndex, raw, message: `Unknown @period: @${period}` });
        continue;
      }
      const fields: CronField = {
        minute: expandField(schedule.split(/\s+/)[0], 0),
        hour: expandField(schedule.split(/\s+/)[1], 1),
        dayOfMonth: expandField(schedule.split(/\s+/)[2], 2),
        month: expandField(schedule.split(/\s+/)[3], 3),
        dayOfWeek: expandField(schedule.split(/\s+/)[4], 4),
      };
      entries.push({
        schedule: `@${period}`,
        fields,
        command,
        description: describeEntry(fields),
        raw,
        lineIndex,
      });
      continue;
    }

    // Standard 5-field cron + command
    const parts = raw.split(/\s+/);
    if (parts.length < 6) {
      errors.push({ lineIndex, raw, message: 'Expected at least 6 fields (5 schedule + command)' });
      continue;
    }

    const [minStr, hourStr, domStr, monStr, dowStr] = parts.slice(0, 5);
    const command = parts.slice(5).join(' ');
    const scheduleStr = [minStr, hourStr, domStr, monStr, dowStr].join(' ');

    try {
      const fields: CronField = {
        minute: expandField(minStr, 0),
        hour: expandField(hourStr, 1),
        dayOfMonth: expandField(domStr, 2),
        month: expandField(monStr, 3),
        dayOfWeek: expandField(dowStr, 4),
      };

      // Validate
      for (let fi = 0; fi < 5; fi++) {
        const vals = [fields.minute, fields.hour, fields.dayOfMonth, fields.month, fields.dayOfWeek][fi];
        const err = validateField(vals, fi);
        if (err) {
          errors.push({ lineIndex, raw, message: err });
          break;
        }
      }

      if (errors.some(e => e.lineIndex === lineIndex)) continue;

      entries.push({
        schedule: scheduleStr,
        fields,
        command,
        description: describeEntry(fields),
        raw,
        lineIndex,
      });
    } catch (err: any) {
      errors.push({ lineIndex, raw, message: err.message });
    }
  }

  return { entries, errors };
}

// ── Next runs ────────────────────────────────────────────────────────────

export function getNextRuns(entry: ParsedEntry, count: number = 5, from?: Date): Date[] {
  const start = from ?? new Date();
  const runs: Date[] = [];
  const cursor = new Date(start);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  const maxIterations = 525600; // 1 year of minutes
  let iterations = 0;

  while (runs.length < count && iterations < maxIterations) {
    iterations++;
    const m = cursor.getMinutes();
    const h = cursor.getHours();
    const d = cursor.getDate();
    const mo = cursor.getMonth() + 1;
    const dow = cursor.getDay();

    if (
      entry.fields.minute.includes(m) &&
      entry.fields.hour.includes(h) &&
      entry.fields.dayOfMonth.includes(d) &&
      entry.fields.month.includes(mo) &&
      entry.fields.dayOfWeek.includes(dow)
    ) {
      runs.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return runs;
}

// ── Format helpers ───────────────────────────────────────────────────────

export function formatTable(entries: ParsedEntry[]): string {
  const lines: string[] = [];
  const schedW = Math.max(12, ...entries.map(e => e.schedule.length));
  const cmdW = Math.max(7, ...entries.map(e => e.command.length));
  const descW = Math.max(11, ...entries.map(e => e.description.length));

  lines.push(
    'Schedule'.padEnd(schedW) + '  ' +
    'Command'.padEnd(Math.min(cmdW, 40)) + '  ' +
    'Description'
  );
  lines.push('-'.repeat(schedW) + '  ' + '-'.repeat(Math.min(cmdW, 40)) + '  ' + '-'.repeat(descW));

  for (const e of entries) {
    const cmd = e.command.length > 40 ? e.command.slice(0, 37) + '...' : e.command;
    lines.push(
      e.schedule.padEnd(schedW) + '  ' +
      cmd.padEnd(40) + '  ' +
      e.description
    );
  }

  return lines.join('\n');
}

export function formatJSON(entries: ParsedEntry[], errors: ValidationError[], conflicts: Conflict[]): object {
  return {
    entries: entries.map(e => ({
      schedule: e.schedule,
      command: e.command,
      description: e.description,
      line: e.lineIndex + 1,
      fields: {
        minute: e.fields.minute,
        hour: e.fields.hour,
        dayOfMonth: e.fields.dayOfMonth,
        month: e.fields.month,
        dayOfWeek: e.fields.dayOfWeek,
      },
    })),
    errors: errors.map(e => ({ line: e.lineIndex + 1, message: e.message, raw: e.raw })),
    conflicts: conflicts.map(c => ({ line1: c.entry1 + 1, line2: c.entry2 + 1, reason: c.reason })),
  };
}
