import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCrontab, detectConflicts, getNextRuns, formatTable, formatJSON } from '../parser.js';

describe('croncat', () => {
  describe('parseCrontab', () => {
    it('parses a basic 5-field entry', () => {
      const { entries, errors } = parseCrontab('0 2 * * * /usr/bin/backup.sh');
      assert.equal(errors.length, 0);
      assert.equal(entries.length, 1);
      assert.equal(entries[0].command, '/usr/bin/backup.sh');
      assert.deepEqual(entries[0].fields.minute, [0]);
      assert.deepEqual(entries[0].fields.hour, [2]);
    });

    it('skips comments and blank lines', () => {
      const crontab = `# This is a comment

0 * * * * echo hi
# Another comment`;
      const { entries } = parseCrontab(crontab);
      assert.equal(entries.length, 1);
    });

    it('skips env variable lines', () => {
      const { entries } = parseCrontab('SHELL=/bin/bash\n0 0 * * * echo hi');
      assert.equal(entries.length, 1);
    });

    it('handles comma-separated values', () => {
      const { entries } = parseCrontab('0,15,30,45 * * * * echo tick');
      assert.deepEqual(entries[0].fields.minute, [0, 15, 30, 45]);
    });

    it('handles ranges', () => {
      const { entries } = parseCrontab('0 9-17 * * * echo work');
      assert.deepEqual(entries[0].fields.hour, [9, 10, 11, 12, 13, 14, 15, 16, 17]);
    });

    it('handles step values', () => {
      const { entries } = parseCrontab('*/15 * * * * echo step');
      assert.deepEqual(entries[0].fields.minute, [0, 15, 30, 45]);
    });

    it('handles range with step', () => {
      const { entries } = parseCrontab('0 0-23/2 * * * echo bihourly');
      assert.deepEqual(entries[0].fields.hour, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
    });

    it('handles day-of-week names', () => {
      const { entries } = parseCrontab('0 0 * * mon-fri echo weekday');
      assert.deepEqual(entries[0].fields.dayOfWeek, [1, 2, 3, 4, 5]);
    });

    it('handles month names', () => {
      const { entries } = parseCrontab('0 0 1 jan,jun,dec * echo quarterly');
      assert.deepEqual(entries[0].fields.month, [1, 6, 12]);
    });

    it('handles @special schedules', () => {
      const { entries, errors } = parseCrontab('@hourly echo hello\n@daily echo day\n@weekly echo week');
      assert.equal(errors.length, 0);
      assert.equal(entries.length, 3);
      assert.equal(entries[0].schedule, '@hourly');
      assert.equal(entries[0].command, 'echo hello');
      assert.deepEqual(entries[0].fields.minute, [0]);
      assert.deepEqual(entries[0].fields.hour, Array.from({ length: 24 }, (_, i) => i));
    });

    it('reports error for unknown @period', () => {
      const { entries, errors } = parseCrontab('@yearly echo hi\n@nonsense echo bad');
      assert.equal(entries.length, 1);
      assert.equal(errors.length, 1);
      assert.ok(errors[0].message.includes('Unknown @period'));
    });

    it('reports error for too few fields', () => {
      const { entries, errors } = parseCrontab('0 0 * * *');
      assert.equal(entries.length, 0);
      assert.equal(errors.length, 1);
      assert.ok(errors[0].message.includes('6 fields'));
    });

    it('reports error for out-of-range values', () => {
      const { errors } = parseCrontab('60 0 * * * echo bad');
      assert.equal(errors.length, 1);
      assert.ok(errors[0].message.includes('out of range'));
    });

    it('reports error for invalid field', () => {
      const { errors } = parseCrontab('abc 0 * * * echo bad');
      assert.equal(errors.length, 1);
      assert.ok(errors[0].message.includes('Invalid'));
    });

    it('generates human-readable descriptions', () => {
      const { entries } = parseCrontab('30 4 * * * /opt/daily.sh');
      assert.ok(entries[0].description.includes('4:00'));
      assert.ok(entries[0].description.includes('30'));
    });

    it('describes every minute', () => {
      const { entries } = parseCrontab('* * * * * echo all');
      assert.equal(entries[0].description, 'every minute');
    });

    it('parses multiple entries', () => {
      const crontab = `0 0 * * * daily.sh
0 * * * * hourly.sh
*/5 * * * * frequent.sh`;
      const { entries, errors } = parseCrontab(crontab);
      assert.equal(errors.length, 0);
      assert.equal(entries.length, 3);
    });
  });

  describe('detectConflicts', () => {
    it('detects overlapping schedules', () => {
      const { entries } = parseCrontab('0 0 * * * echo a\n0 0 * * * echo b');
      const conflicts = detectConflicts(entries);
      assert.equal(conflicts.length, 1);
    });

    it('does not flag non-overlapping schedules', () => {
      const { entries } = parseCrontab('0 0 * * * echo a\n0 1 * * * echo b');
      const conflicts = detectConflicts(entries);
      assert.equal(conflicts.length, 0);
    });

    it('handles partial overlaps correctly', () => {
      const { entries } = parseCrontab('0 0,12 * * * echo a\n0 0 * * * echo b');
      const conflicts = detectConflicts(entries);
      assert.equal(conflicts.length, 1);
    });
  });

  describe('getNextRuns', () => {
    it('returns correct number of runs', () => {
      const { entries } = parseCrontab('0 * * * * echo hourly');
      const runs = getNextRuns(entries[0], 3, new Date('2026-01-01T00:00:00Z'));
      assert.equal(runs.length, 3);
      assert.equal(runs[0].getUTCMinutes(), 0);
      assert.equal(runs[0].getUTCHours(), 1);
    });

    it('returns empty for impossible schedules within limit', () => {
      const { entries } = parseCrontab('0 0 31 2 * echo feb31');
      // February never has 31st — won't find runs
      const runs = getNextRuns(entries[0], 1, new Date('2026-01-01T00:00:00Z'));
      assert.equal(runs.length, 0);
    });

    it('respects day-of-week constraint', () => {
      const { entries } = parseCrontab('0 0 * * 1 echo monday');
      const runs = getNextRuns(entries[0], 3, new Date('2026-01-01T00:00:00Z'));
      // 2026-01-01 is Thursday
      for (const r of runs) {
        assert.equal(r.getDay(), 1); // Monday
      }
    });
  });

  describe('formatTable', () => {
    it('produces a table with header', () => {
      const { entries } = parseCrontab('0 0 * * * daily.sh');
      const table = formatTable(entries);
      assert.ok(table.includes('Schedule'));
      assert.ok(table.includes('daily.sh'));
    });
  });

  describe('formatJSON', () => {
    it('produces valid JSON structure', () => {
      const { entries, errors } = parseCrontab('0 0 * * * daily.sh');
      const conflicts = detectConflicts(entries);
      const json = formatJSON(entries, errors, conflicts) as any;
      assert.ok(json.entries);
      assert.ok(json.errors);
      assert.ok(json.conflicts);
      assert.equal(json.entries[0].line, 1);
      assert.equal(json.entries[0].command, 'daily.sh');
    });
  });

  describe('wildcard and edge cases', () => {
    it('handles ? as wildcard (day fields)', () => {
      const { entries, errors } = parseCrontab('0 0 ? * * echo q');
      assert.equal(errors.length, 0);
      assert.equal(entries.length, 1);
    });

    it('handles step with start value', () => {
      const { entries } = parseCrontab('10/20 * * * * echo step');
      // 10, 30, 50
      assert.deepEqual(entries[0].fields.minute, [10, 30, 50]);
    });

    it('handles day-of-week 0-6 range', () => {
      const { entries, errors } = parseCrontab('0 0 * * 0-6 echo allweek');
      assert.equal(errors.length, 0);
      assert.deepEqual(entries[0].fields.dayOfWeek, [0, 1, 2, 3, 4, 5, 6]);
    });

    it('handles @midnight alias', () => {
      const { entries } = parseCrontab('@midnight echo midnight');
      assert.equal(entries[0].schedule, '@midnight');
      assert.deepEqual(entries[0].fields.hour, [0]);
    });
  });
});
