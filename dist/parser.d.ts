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
export interface ValidationError {
    lineIndex: number;
    raw: string;
    message: string;
}
export interface Conflict {
    entry1: number;
    entry2: number;
    reason: string;
}
export declare function detectConflicts(entries: ParsedEntry[]): Conflict[];
export declare function parseCrontab(content: string): {
    entries: ParsedEntry[];
    errors: ValidationError[];
};
export declare function getNextRuns(entry: ParsedEntry, count?: number, from?: Date): Date[];
export declare function formatTable(entries: ParsedEntry[]): string;
export declare function formatJSON(entries: ParsedEntry[], errors: ValidationError[], conflicts: Conflict[]): object;
