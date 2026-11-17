#!/usr/bin/env node
/** Replays the historical F0..F1.6B chain in an isolated local clone. Never updates caller's git index or worktree. */
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, readdirSync, rmSync, statSync, existsSync} from 'node:fs';
import {tmpdir, homedir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compareChecksums, validatePatchList} from './gates.mjs';

const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const data=JSON.parse(readFileSync(join(root,'scripts/integrity/patch-chain.json'),'utf8'));
validatePatchList(data.stages);
let downloads=join(homedir(),'Downloads');
const options=process.argv.slice(2);
for (let i=0;i<options.length;i++) {
  if (options[i]==='--downloads' && options[i+1]) downloads=resolve(options[++i]);
  else throw new Error(`Unknown option ${options[i]}`);
}
function cmd(args,cwd=root) {
  const result=spawnSync('git',args,{cwd,encoding:'utf8',timeout:45_000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
  if (result.error || result.status!==0) throw new Error(`git ${args.slice(0,4).join(' ')}: ${(result.stderr||result.error?.message||'').slice(-1000)}`);
  return result.stdout.trim();
}
function sha(path) {return createHash('sha256').update(readFileSync(path)).digest('hex');}
function sourceHash(path) {
  const bytes=readFileSync(path);
  // gitattributes may convert PowerShell/batch text to CRLF on checkout. Compare normalized text, never binaries.
  const data=/\.(ps1|bat|cmd)$/i.test(path) ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n')) : bytes;
  return createHash('sha256').update(data).digest('hex');
}
const patches=[];
let missing=[];
for (const stage of data.stages) {
  const file=stage.external?join(downloads,stage.file):join(root,stage.file);
  if (!existsSync(file)) {missing.push(file);continue;}
  compareChecksums(sha(file),stage.sha256);
  patches.push({...stage,path:file});
}
if (missing.length) {
  console.error(`BLOCKED: Missing ${missing.length} patch file(s). Extract F1.6A, F1.6A.1 and F1.6B ZIPs into ${downloads}, or pass --downloads PATH.`);
  for (const file of missing) console.error(`  ${file}`);
  process.exit(78);
}
let base;
try {base=cmd(['rev-parse','--verify','--quiet',`${data.baseCommit}^{commit}`]);}
catch {console.error(`BLOCKED: Git base ${data.baseCommit} is unavailable in this repository`);process.exit(78);}
const temp=mkdtempSync(join(tmpdir(),'launchbed-replay-'));
const clone=join(temp,'checkout');
const omit=new Set(['.git','build','dist','.astro','node_modules','coverage','.gradle','.idea','patches']);
// The historical replay ends at F1.6B. Later files are independently protected
// by each incremental installer and are excluded from its F1.6B content parity.
const laterChanged=new Set([
  'justfile','package.json','README.md','.github/workflows/ci.yml','docs/roadmap.md',
  'docs/integrity.md','scripts/integrity-check.ts','scripts/integrity/gates.mjs',
  'scripts/integrity/gates.d.mts','scripts/integrity/patch-replay.mjs',
  'packages/generator/src/templates.generated.ts','templates/android-compose-minimal/README.md',
  'templates/android-compose-minimal/app/build.gradle.kts',
  'templates/android-compose-minimal/app/src/main/AndroidManifest.xml',
]);
function walk(dir,prefix='') {
  const map=new Map();
  for (const ent of readdirSync(dir,{withFileTypes:true})) {
    if (omit.has(ent.name)) continue;
    const name=prefix?`${prefix}/${ent.name}`:ent.name;
    if (name.startsWith('scripts/integrity/') || name.startsWith('scripts/release/') || name==='scripts/release-audit.ts' ||
      name==='tests/release-policy.test.ts' || name.startsWith('templates/android-compose-minimal/app/src/main/res/xml/') ||
      name.startsWith('docs/phases/F1.6C-') || name.startsWith('docs/phases/F1.6D-') || laterChanged.has(name)) continue;
    if (ent.isDirectory()) for(const [key,value] of walk(join(dir,ent.name),name)) map.set(key,value);
    else if(ent.isFile()) map.set(name,sourceHash(join(dir,ent.name)));
    else throw new Error(`Unexpected symlink or special file: ${name}`);
  }
  return map;
}
try {
  cmd(['clone','--quiet','--no-hardlinks','--no-checkout',root,clone]);
  cmd(['checkout','--quiet','--detach',base],clone);
  for (const patch of patches) {
    cmd(['apply','--check','--binary',patch.path],clone);
    cmd(['apply','--binary',patch.path],clone);
    console.log(`PASS ${patch.name}: SHA-256 verified; applied in temporary checkout`);
  }
  const theirs=walk(clone), ours=walk(root);
  const errors=[];
  for(const [name,hash] of theirs) {
    if(ours.get(name)!==hash) errors.push(`${name}: ${ours.has(name)?'content differs':'missing in working tree'}`);
  }
  for(const name of ours.keys()) if(!theirs.has(name)) errors.push(`${name}: unexpected in working tree`);
  if (errors.length) throw new Error(`${errors.length} source-tree difference(s) after replay:\n${errors.slice(0,20).join('\n')}`);
  console.log(`PASS: ${patches.length} patches applied; ${theirs.size} unchanged F1.6B files match (PowerShell/batch EOL normalized; F1.6C–F1.6D changes excluded)`);
  console.log('The F1.6C and F1.6D patches are not part of this F0–F1.6B historical replay; their ZIP installers separately verify SHA-256 and git apply.');
} finally {rmSync(temp,{recursive:true,force:true});}
