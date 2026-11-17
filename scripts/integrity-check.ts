#!/usr/bin/env bun
/** F1.6C: read-only generated artifact and release-evidence gates. No SDK, network or device access. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateProject, parseRequest, readZip, verifyZipAgainstPlan } from '@launchbed/generator';
import { LIMITS, validateRelativePath } from '@launchbed/schema';
import { checkReleaseApks, checkReleaseEvidence, PRESETS, sensitivePath } from './integrity/gates.mjs';
import { runtimeSourceFingerprint } from './runtime/source-fingerprint.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const REPORT=join(ROOT,'build','integrity','report.json');
const seed=JSON.parse(readFileSync(join(ROOT,'examples','basic.json'),'utf8')) as Record<string,unknown>;
const args=process.argv.slice(2);
if (args.some((arg)=>arg !== '--release')) {
  console.error('Usage: bun run scripts/integrity-check.ts [--release]');
  process.exit(2);
}
const release=args.includes('--release');
type Check={name:string;status:'PASS'|'FAIL'|'BLOCKED'|'NOT RUN';detail:string};
const checks:Check[]=[];
const add=(name:string,status:Check['status'],detail:string)=>checks.push({name,status,detail});
const sha=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
const readJson=(path:string):unknown=>{
  if (!existsSync(path)) return null;
  try {return JSON.parse(readFileSync(path,'utf8'));}
  catch {return {__invalid:true};}
};
const forbidden=new Set(['.git','node_modules','build','.gradle','.idea']);
for (const preset of PRESETS) {
  try {
    const suffix=preset.replaceAll('-','');
    const request=parseRequest({...seed, preset, projectName:`Integrity ${preset}`, addons:[],
      applicationId:`dev.launchbed.integrity.${suffix}`,namespace:`dev.launchbed.generated.${suffix}`,
      packageName:`dev.launchbed.generated.${suffix}`});
    const output=generateProject(request);
    verifyZipAgainstPlan(output.zip,output.plan);
    const repeated=generateProject(request);
    if (sha(repeated.zip)!==sha(output.zip)) throw new Error('ZIP bytes changed between identical requests');
    const entries=readZip(output.zip);
    if (!entries.length || entries.length>LIMITS.files) throw new Error('Invalid ZIP entry count');
    let bytes=0;
    for (const entry of entries) {
      bytes+=entry.size;
      const path=entry.path;
      if (validateRelativePath(path,'generated ZIP').length) throw new Error(`Unsafe path: ${path}`);
      if (sensitivePath(path) || path.split('/').some(s=>forbidden.has(s))) throw new Error(`Sensitive/generated-only path: ${path}`);
      if (!Number.isSafeInteger(entry.size) || entry.size<0) throw new Error(`Invalid entry size: ${path}`);
    }
    if (bytes>LIMITS.totalBytes) throw new Error('ZIP uncompressed contents exceed configured limit');
    if (preset==='compose-minimal') {
      const names=entries.map(e=>e.path);
      if (names.some(p=>p.includes('/feature/notes/')||p.includes('/ui/navigation/')||p.includes('/data/local/Note'))) throw new Error('Minimal preset includes optional feature files');
      const gradle=entries.find(e=>e.path==='app/build.gradle.kts');
      if (!gradle) throw new Error('App Gradle file absent');
      const content=new TextDecoder().decode(gradle.data);
      if (/libs\.plugins\.(room|ksp)|libs\.(room|navigation3)/i.test(content)) throw new Error('Minimal preset includes optional Room/Navigation dependencies');
    }
    const wrapper=entries.find(e=>e.path==='gradle/wrapper/gradle-wrapper.properties');
    if (!wrapper || !/distributionSha256Sum=[a-f0-9]{64}/.test(new TextDecoder().decode(wrapper.data))) throw new Error('Gradle distribution missing SHA-256 pin');
    const nativeSources=entries.filter(e=>e.path.endsWith('.so')||e.path.endsWith('.a')).map(e=>e.path);
    if (nativeSources.length) add(`native-source:${preset}`,'BLOCKED',`Native libraries require runtime 16 KB validation: ${nativeSources.join(', ')}`);
    else add(`native-source:${preset}`,'PASS','No precompiled native .so/.a in generated source ZIP (APK transitives not audited)');
    add(`project:${preset}`,'PASS',`${entries.length} files, ${bytes} source bytes, SHA-256 ${sha(output.zip)}`);
  } catch (error) {
    add(`project:${preset}`,'FAIL',String(error));
  }
}
try {
  const license=readFileSync(join(ROOT,'LICENSE'),'utf8');
  add('repository-license', /MIT License|Permission is hereby granted, free of charge/.test(license)?'PASS':'FAIL','Local LICENSE inspected; dependency license audit requires separate tooling');
} catch (error) {add('repository-license','FAIL',String(error));}
if (release) {
  const releaseGradle=readFileSync(join(ROOT,'templates/android-compose-minimal/app/build.gradle.kts'),'utf8');
  const manifest=readFileSync(join(ROOT,'templates/android-compose-minimal/app/src/main/AndroidManifest.xml'),'utf8');
  const rulesDir=join(ROOT,'templates/android-compose-minimal/app/src/main/res/xml');
  const legacy=readFileSync(join(rulesDir,'backup_rules.xml'),'utf8');
  const extraction=readFileSync(join(rulesDir,'data_extraction_rules.xml'),'utf8');
  const optimized=/optimization\s*\{\s*enable\s*=\s*true\s*\}/.test(releaseGradle) && !/isMinifyEnabled\s*=\s*false/.test(releaseGradle);
  if(!optimized) add('release:r8-config','BLOCKED','Release optimization not configured');
  else add('release:r8-config','PASS','AGP 9.3+ R8/resource optimization enabled (build evidence separate)');
  const backup= /android:allowBackup="false"/.test(manifest) && /android:fullBackupContent="@xml\/backup_rules"/.test(manifest)
    && /android:dataExtractionRules="@xml\/data_extraction_rules"/.test(manifest)
    && /<exclude domain="root" path="\."\s*\/>/.test(legacy)
    && /<cloud-backup>/.test(extraction) && /<device-transfer>/.test(extraction)
    && (extraction.match(/<exclude domain="root" path="\."\s*\/>/g)??[]).length===2;
  add('release:backup-policy',backup?'PASS':'BLOCKED',backup?'Explicit local-first cloud/D2D and legacy backup exclusions configured; OEM runtime not certified':'Backup exclusions incomplete');
  const fingerprint=sha(readFileSync(join(ROOT,'packages/generator/src/templates.generated.ts')));
  const releaseReport=readJson(join(ROOT,'build','release-audit','report.json'));
  for (const result of checkReleaseApks(releaseReport,fingerprint)) add(`release:${result.name}`,result.status,result.detail);
}

// A compile-only run must never become runtime release evidence.
const runtime=readJson(join(ROOT,'build','runtime-verification','device-report.json'));
const android=readJson(join(ROOT,'build','performance','android.json'));
const generator=readJson(join(ROOT,'build','performance','generator.json'));
const evidence=checkReleaseEvidence(runtime,android,generator,release?runtimeSourceFingerprint(ROOT):undefined);
for (const entry of evidence.gates) add(`evidence:${entry.name}`,entry.status,entry.detail);
const generated=checks.filter(e=>!e.name.startsWith('evidence:'));
const generatedStatus=generated.some(e=>e.status==='FAIL')?'FAIL':generated.some(e=>e.status==='BLOCKED')?'BLOCKED':'PASS';
const status=generatedStatus==='FAIL'||evidence.status==='FAIL'?'FAIL':(release && (generatedStatus==='BLOCKED'||evidence.status==='BLOCKED'))?'BLOCKED':generatedStatus;
const report={schemaVersion:1,kind:'integrity',generatedAt:new Date().toISOString(),
  environment:{platform:process.platform,arch:process.arch,bun:typeof Bun!=='undefined'?Bun.version:null,node:process.versions.node},
  mode:release?'release-evidence':'generator-integrity',status,
  notes:['No device commands or SDK installations performed','PASS for source ZIP does not establish APK runtime, 16 KB native compatibility, dependency CVE or Play release readiness','Benchmark reports, if present, are local evidence rather than timing thresholds'],
  checks};
mkdirSync(dirname(REPORT),{recursive:true});
writeFileSync(`${REPORT}.tmp`,`${JSON.stringify(report,null,2)}\n`);
renameSync(`${REPORT}.tmp`,REPORT);
for (const item of checks) console.log(`${item.status.padEnd(7)} ${item.name}: ${item.detail}`);
console.log(`Integrity report: ${REPORT}; mode=${report.mode}, status=${status}`);
if (status==='FAIL') process.exitCode=1;
else if (status==='BLOCKED' && release) process.exitCode=78;
