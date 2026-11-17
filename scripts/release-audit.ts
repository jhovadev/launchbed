#!/usr/bin/env bun
/** Opt-in optimized release build and APK inspection for Launchbed presets. No device action. */
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname, isAbsolute, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateProject, parseRequest, readZip, verifyZipAgainstPlan} from '@launchbed/generator';
import {PRESETS} from './integrity/gates.mjs';
import {inspectApk} from './release/native-apk.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const OUT=join(ROOT,'build','release-audit');
const REPORT=join(OUT,'report.json');
const seed=JSON.parse(readFileSync(join(ROOT,'examples/basic.json'),'utf8')) as Record<string,unknown>;
type Status='PASS'|'FAIL'|'BLOCKED';
type Check={status:Status; detail:string};
function parse(argv:string[]) {
  const [command,...rest]=argv;
  if(command!=='build' && command!=='inspect-apk') throw new Error('Usage: release-audit.ts build [--all|--preset ID] | inspect-apk --apk PATH');
  let all=false, preset:string|undefined, apk:string|undefined;
  for(let i=0;i<rest.length;i++) {
    const arg=rest[i];
    if(arg==='--all'){all=true;continue;}
    if(arg==='--preset' || arg==='--apk') {
      const value=rest[++i]; if(!value || value.startsWith('--')) throw new Error(`${arg} needs a value`);
      if(arg==='--preset') preset=value; else apk=value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if(command==='inspect-apk') {if(!apk||preset||all) throw new Error('inspect-apk requires --apk PATH');return {command,apk,presets:[]};}
  if(apk|| (preset&&all))throw new Error('Use --all or --preset ID');
  if(preset && !(PRESETS as readonly string[]).includes(preset)) throw new Error(`Unknown preset ${preset}`);
  return {command,apk,presets:all?[...PRESETS]:[preset??'compose-minimal']};
}
function sdkLocation() {
  return [process.env.ANDROID_HOME,process.env.ANDROID_SDK_ROOT,join(homedir(),'Android','Sdk'),join(homedir(),'Library','Android','sdk')]
    .find(value=>value&&existsSync(value));
}
function checkPolicy(files:Map<string,Uint8Array>):{r8:Check;backup:Check} {
  const source=(path:string)=>new TextDecoder().decode(files.get(path)??new Uint8Array());
  const gradle=source('app/build.gradle.kts');
  const manifest=source('app/src/main/AndroidManifest.xml');
  const legacy=source('app/src/main/res/xml/backup_rules.xml');
  const modern=source('app/src/main/res/xml/data_extraction_rules.xml');
  const r8= /optimization\s*\{\s*enable\s*=\s*true\s*\}/.test(gradle) && !/isMinifyEnabled\s*=\s*false/.test(gradle);
  const excluded=(xml:string)=>['root','device_root','external'].every(domain=>new RegExp(`<exclude\\s+domain="${domain}"\\s+path="\\."\\s*/>`).test(xml));
  const backup= /android:allowBackup="false"/.test(manifest) && /android:fullBackupContent="@xml\/backup_rules"/.test(manifest)
    && /android:dataExtractionRules="@xml\/data_extraction_rules"/.test(manifest)
    && excluded(legacy) && /<cloud-backup>/.test(modern) && /<device-transfer>/.test(modern)
    && excluded(modern.split('</cloud-backup>')[0]??'') && excluded(modern.split('<device-transfer>')[1]??'');
  return {r8:{status:r8?'PASS':'FAIL',detail:r8?'AGP 9.3+ release optimization configured':'Release R8 configuration missing'},
    backup:{status:backup?'PASS':'FAIL',detail:backup?'Backup disabled and cloud/D2D explicit exclusions present; OEM behavior still requires review':'Incomplete cloud/D2D/legacy backup exclusions'}};
}
async function unpack(preset:string,dir:string) {
  const suffix=preset.replaceAll('-','');
  const project=await generateProject(parseRequest({...seed,preset,addons:[],projectName:`Release Audit ${preset}`,
    applicationId:`dev.launchbed.release.${suffix}`,namespace:`dev.launchbed.release.${suffix}`}));
  verifyZipAgainstPlan(project.zip,project.plan);
  const entries=readZip(project.zip);
  const files=new Map(entries.map(e=>[e.path,e.data]));
  for(const entry of entries) {
    const path=resolve(dir,entry.path), rel=relative(dir,path);
    if(!rel || rel==='..' || rel.startsWith('..\\') || rel.startsWith('../') || isAbsolute(rel)) throw new Error(`Unsafe generated path ${entry.path}`);
    mkdirSync(dirname(path),{recursive:true});
    writeFileSync(path,entry.data);
    chmodSync(path,entry.executable?0o755:0o644);
  }
  return {hash:createHash('sha256').update(project.zip).digest('hex'), policy:checkPolicy(files)};
}
function runGradle(cwd:string,sdk:string) {
  const windows=process.platform==='win32';
  const cmd=windows?(process.env.ComSpec??'cmd.exe'):'./gradlew';
  const args=[...(windows?['/d','/s','/c','gradlew.bat']:[]),':app:assembleRelease',':app:lintRelease','--no-daemon','--console=plain'];
  const result=spawnSync(cmd,args,{cwd,env:{...process.env,ANDROID_HOME:sdk,ANDROID_SDK_ROOT:sdk},encoding:'utf8',
    stdio:['ignore','pipe','pipe'],maxBuffer:12*1024*1024,timeout:20*60_000,shell:false});
  return {ok:result.status===0&&!result.error,detail:result.status===0?'Gradle release and lint exited 0':(result.error?.message||result.stderr?.slice(-1400)||'Gradle failed')};
}
function writeReport(data:unknown) {
  mkdirSync(OUT,{recursive:true});
  writeFileSync(`${REPORT}.tmp`,`${JSON.stringify(data,null,2)}\n`);
  renameSync(`${REPORT}.tmp`,REPORT);
  console.log(`Report: ${REPORT}`);
}
try {
  const config=parse(process.argv.slice(2));
  if(config.command==='inspect-apk') {
    const result=inspectApk(resolve(config.apk!));
    console.log(JSON.stringify(result,null,2));
  } else {
    const sdk=sdkLocation();
    const results=[];
    let code=0;
    for(const preset of config.presets) {
      const row:Record<string,unknown>={preset,status:'BLOCKED',r8:{status:'BLOCKED'},backup:{status:'BLOCKED'},native:{status:'BLOCKED'}};
      if(!sdk) {row.detail='Android SDK unavailable; no Gradle release build attempted'; results.push(row);code=78;continue;}
      const dir=join(OUT,'projects',preset);
      try {
        rmSync(dir,{recursive:true,force:true}); mkdirSync(dir,{recursive:true});
        const generated=await unpack(preset,dir);
        row.zipSha256=generated.hash;row.r8=generated.policy.r8;row.backup=generated.policy.backup;
        if(generated.policy.r8.status==='FAIL' || generated.policy.backup.status==='FAIL') throw new Error('Generated release/backup policy check failed');
        const gradle=runGradle(dir,sdk);
        row.gradle={status:gradle.ok?'PASS':'FAIL',detail:gradle.detail};
        if(!gradle.ok)throw new Error(`Gradle: ${gradle.detail}`);
        const apk=join(dir,'app','build','outputs','apk','release','app-release-unsigned.apk');
        if(!existsSync(apk))throw new Error(`Release artifact absent: ${apk}`);
        const native=inspectApk(apk);
        row.native={status:native.status,detail:native.detail,libraries:native.libraries};
        row.releaseApkBytes=statSync(apk).size;
        row.status='PASS';
        console.log(`${preset}: PASS release+lint, APK ${row.releaseApkBytes} bytes; ${native.detail}`);
      } catch(error) {
        row.status='FAIL';row.error=String(error);code=1;
        console.error(`${preset}: FAIL ${row.error}`);
      }
      results.push(row);
    }
    writeReport({schemaVersion:1,kind:'release-audit',generatedAt:new Date().toISOString(),
      generatorFingerprint:createHash('sha256').update(readFileSync(join(ROOT,'packages/generator/src/templates.generated.ts'))).digest('hex'),
      note:'Unsigned optimized release APKs; static audit does not prove runtime, signing, Play compliance or OEM backup behavior',
      results});
    if(code) process.exitCode=code;
  }
} catch(error) {console.error(`FAIL: ${String(error)}`);process.exitCode=1;}
