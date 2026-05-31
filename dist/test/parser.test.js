"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const parser_js_1 = require("../parser.js");
(0, node_test_1.describe)('croncat', () => {
    (0, node_test_1.describe)('parseCrontab', () => {
        (0, node_test_1.it)('parses a basic 5-field entry', () => {
            const { entries, errors } = (0, parser_js_1.parseCrontab)('0 2 * * * /usr/bin/backup.sh');
            strict_1.default.equal(errors.length, 0);
            strict_1.default.equal(entries.length, 1);
            strict_1.default.equal(entries[0].command, '/usr/bin/backup.sh');
            strict_1.default.deepEqual(entries[0].fields.minute, [0]);
            strict_1.default.deepEqual(entries[0].fields.hour, [2]);
        });
        (0, node_test_1.it)('skips comments and blank lines', () => {
            const crontab = `# This is a comment

0 * * * * echo hi
# Another comment`;
            const { entries } = (0, parser_js_1.parseCrontab)(crontab);
            strict_1.default.equal(entries.length, 1);
        });
        (0, node_test_1.it)('skips env variable lines', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('SHELL=/bin/bash\n0 0 * * * echo hi');
            strict_1.default.equal(entries.length, 1);
        });
        (0, node_test_1.it)('handles comma-separated values', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('0,15,30,45 * * * * echo tick');
            strict_1.default.deepEqual(entries[0].fields.minute, [0, 15, 30, 45]);
        });
        (0, node_test_1.it)('handles ranges', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('0 9-17 * * * echo work');
            strict_1.default.deepEqual(entries[0].fields.hour, [9, 10, 11, 12, 13, 14, 15, 16, 17]);
        });
        (0, node_test_1.it)('handles step values', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('*/15 * * * * echo step');
            strict_1.default.deepEqual(entries[0].fields.minute, [0, 15, 30, 45]);
        });
        (0, node_test_1.it)('handles range with step', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('0 0-23/2 * * * echo bihourly');
            strict_1.default.deepEqual(entries[0].fields.hour, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
        });
        (0, node_test_1.it)('handles day-of-week names', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('0 0 * * mon-fri echo weekday');
            strict_1.default.deepEqual(entries[0].fields.dayOfWeek, [1, 2, 3, 4, 5]);
        });
        (0, node_test_1.it)('handles month names', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('0 0 1 jan,jun,dec * echo quarterly');
            strict_1.default.deepEqual(entries[0].fields.month, [1, 6, 12]);
        });
        (0, node_test_1.it)('handles @special schedules', () => {
            const { entries, errors } = (0, parser_js_1.parseCrontab)('@hourly echo hello\n@daily echo day\n@weekly echo week');
            strict_1.default.equal(errors.length, 0);
            strict_1.default.equal(entries.length, 3);
            strict_1.default.equal(entries[0].schedule, '@hourly');
            strict_1.default.equal(entries[0].command, 'echo hello');
            strict_1.default.deepEqual(entries[0].fields.minute, [0]);
            strict_1.default.deepEqual(entries[0].fields.hour, Array.from({ length: 24 }, (_, i) => i));
        });
        (0, node_test_1.it)('reports error for unknown @period', () => {
            const { entries, errors } = (0, parser_js_1.parseCrontab)('@yearly echo hi\n@nonsense echo bad');
            strict_1.default.equal(entries.length, 1);
            strict_1.default.equal(errors.length, 1);
            strict_1.default.ok(errors[0].message.includes('Unknown @period'));
        });
        (0, node_test_1.it)('reports error for too few fields', () => {
            const { entries, errors } = (0, parser_js_1.parseCrontab)('0 0 * * *');
            strict_1.default.equal(entries.length, 0);
            strict_1.default.equal(errors.length, 1);
            strict_1.default.ok(errors[0].message.includes('6 fields'));
        });
        (0, node_test_1.it)('reports error for out-of-range values', () => {
            const { errors } = (0, parser_js_1.parseCrontab)('60 0 * * * echo bad');
            strict_1.default.equal(errors.length, 1);
            strict_1.default.ok(errors[0].message.includes('out of range'));
        });
        (0, node_test_1.it)('reports error for invalid field', () => {
            const { errors } = (0, parser_js_1.parseCrontab)('abc 0 * * * echo bad');
            strict_1.default.equal(errors.length, 1);
            strict_1.default.ok(errors[0].message.includes('Invalid'));
        });
        (0, node_test_1.it)('generates human-readable descriptions', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('30 4 * * * /opt/daily.sh');
            strict_1.default.ok(entries[0].description.includes('4:00'));
            strict_1.default.ok(entries[0].description.includes('30'));
        });
        (0, node_test_1.it)('describes every minute', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('* * * * * echo all');
            strict_1.default.equal(entries[0].description, 'every minute');
        });
        (0, node_test_1.it)('parses multiple entries', () => {
            const crontab = `0 0 * * * daily.sh
0 * * * * hourly.sh
*/5 * * * * frequent.sh`;
            const { entries, errors } = (0, parser_js_1.parseCrontab)(crontab);
            strict_1.default.equal(errors.length, 0);
            strict_1.default.equal(entries.length, 3);
        });
    });
    (0, node_test_1.describe)('detectConflicts', () => {
        (0, node_test_1.it)('detects overlapping schedules', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('0 0 * * * echo a\n0 0 * * * echo b');
            const conflicts = (0, parser_js_1.detectConflicts)(entries);
            strict_1.default.equal(conflicts.length, 1);
        });
        (0, node_test_1.it)('does not flag non-overlapping schedules', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('0 0 * * * echo a\n0 1 * * * echo b');
            const conflicts = (0, parser_js_1.detectConflicts)(entries);
            strict_1.default.equal(conflicts.length, 0);
        });
        (0, node_test_1.it)('handles partial overlaps correctly', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('0 0,12 * * * echo a\n0 0 * * * echo b');
            const conflicts = (0, parser_js_1.detectConflicts)(entries);
            strict_1.default.equal(conflicts.length, 1);
        });
    });
    (0, node_test_1.describe)('getNextRuns', () => {
        (0, node_test_1.it)('returns correct number of runs', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('0 * * * * echo hourly');
            const runs = (0, parser_js_1.getNextRuns)(entries[0], 3, new Date('2026-01-01T00:00:00Z'));
            strict_1.default.equal(runs.length, 3);
            strict_1.default.equal(runs[0].getUTCMinutes(), 0);
            strict_1.default.equal(runs[0].getUTCHours(), 1);
        });
        (0, node_test_1.it)('returns empty for impossible schedules within limit', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('0 0 31 2 * echo feb31');
            // February never has 31st — won't find runs
            const runs = (0, parser_js_1.getNextRuns)(entries[0], 1, new Date('2026-01-01T00:00:00Z'));
            strict_1.default.equal(runs.length, 0);
        });
        (0, node_test_1.it)('respects day-of-week constraint', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('0 0 * * 1 echo monday');
            const runs = (0, parser_js_1.getNextRuns)(entries[0], 3, new Date('2026-01-01T00:00:00Z'));
            // 2026-01-01 is Thursday
            for (const r of runs) {
                strict_1.default.equal(r.getDay(), 1); // Monday
            }
        });
    });
    (0, node_test_1.describe)('formatTable', () => {
        (0, node_test_1.it)('produces a table with header', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('0 0 * * * daily.sh');
            const table = (0, parser_js_1.formatTable)(entries);
            strict_1.default.ok(table.includes('Schedule'));
            strict_1.default.ok(table.includes('daily.sh'));
        });
    });
    (0, node_test_1.describe)('formatJSON', () => {
        (0, node_test_1.it)('produces valid JSON structure', () => {
            const { entries, errors } = (0, parser_js_1.parseCrontab)('0 0 * * * daily.sh');
            const conflicts = (0, parser_js_1.detectConflicts)(entries);
            const json = (0, parser_js_1.formatJSON)(entries, errors, conflicts);
            strict_1.default.ok(json.entries);
            strict_1.default.ok(json.errors);
            strict_1.default.ok(json.conflicts);
            strict_1.default.equal(json.entries[0].line, 1);
            strict_1.default.equal(json.entries[0].command, 'daily.sh');
        });
    });
    (0, node_test_1.describe)('wildcard and edge cases', () => {
        (0, node_test_1.it)('handles ? as wildcard (day fields)', () => {
            const { entries, errors } = (0, parser_js_1.parseCrontab)('0 0 ? * * echo q');
            strict_1.default.equal(errors.length, 0);
            strict_1.default.equal(entries.length, 1);
        });
        (0, node_test_1.it)('handles step with start value', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('10/20 * * * * echo step');
            // 10, 30, 50
            strict_1.default.deepEqual(entries[0].fields.minute, [10, 30, 50]);
        });
        (0, node_test_1.it)('handles day-of-week 0-6 range', () => {
            const { entries, errors } = (0, parser_js_1.parseCrontab)('0 0 * * 0-6 echo allweek');
            strict_1.default.equal(errors.length, 0);
            strict_1.default.deepEqual(entries[0].fields.dayOfWeek, [0, 1, 2, 3, 4, 5, 6]);
        });
        (0, node_test_1.it)('handles @midnight alias', () => {
            const { entries } = (0, parser_js_1.parseCrontab)('@midnight echo midnight');
            strict_1.default.equal(entries[0].schedule, '@midnight');
            strict_1.default.deepEqual(entries[0].fields.hour, [0]);
        });
    });
});
