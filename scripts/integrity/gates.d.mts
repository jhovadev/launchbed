export type GateStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT RUN';
export interface Gate { name: string; status: GateStatus; detail: string }
export const PRESETS: readonly ['compose-minimal','compose-starter','local-notes','catalog-ui'];
export const RUNTIME_PRESETS: readonly ['compose-starter','local-notes','catalog-ui'];
export function sensitivePath(path:string):boolean;
export function checkReleaseEvidence(runtime:unknown, android:unknown, generator:unknown, expectedRuntimeFingerprint?:string):{gates:Gate[];status:'PASS'|'FAIL'|'BLOCKED'};
export function compareChecksums(actual:string,expected:string):true;
export function validatePatchList(entries:unknown[]):true;
export function checkReleaseApks(report:unknown, fingerprint:string):Gate[];
