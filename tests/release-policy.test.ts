import {describe,expect,test} from 'bun:test';
import {materializeProject} from '@launchbed/generator';
import {baseRequest} from './fixtures';

const decode=(bytes:Uint8Array)=>new TextDecoder().decode(bytes);
const names=['compose-minimal','compose-starter','local-notes','catalog-ui'];
describe('F1.6D generated release/backup policy',()=>{
  for (const preset of names) test(`${preset} embeds AGP release optimization and explicit backup protections`,async ()=>{
    const project=await materializeProject(baseRequest({preset}));
    const file=(name:string)=>{const bytes=project.files.get(name);expect(bytes).toBeDefined();return decode(bytes!);};
    const gradle=file('app/build.gradle.kts');
    expect(gradle).toContain('optimization {');
    expect(gradle).toContain('enable = true');
    expect(gradle).not.toContain('isMinifyEnabled = false');
    const manifest=file('app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('@xml/backup_rules');
    expect(manifest).toContain('@xml/data_extraction_rules');
    const legacy=file('app/src/main/res/xml/backup_rules.xml');
    const modern=file('app/src/main/res/xml/data_extraction_rules.xml');
    expect(legacy).toContain('<exclude domain="root" path="." />');
    expect(modern).toContain('<cloud-backup>');
    expect(modern).toContain('<device-transfer>');
    expect(modern.match(/<exclude domain="root" path="\." \/>/g)?.length).toBe(2);
  });
});
