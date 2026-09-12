import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const dir='docs/auditoria-2026-09-11/evidencias';
const read=p=>{const b=fs.readFileSync(p);return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,'');};
const parse=p=>JSON.parse(read(p));
const audit={};
for(const app of ['frontend','server']) {
 const full=parse(`${dir}/npm-audit-${app}.json`);
 audit[app]={metadata:full.metadata,packages:Object.values(full.vulnerabilities||{}).map(v=>({name:v.name,severity:v.severity,isDirect:v.isDirect,fixAvailable:v.fixAvailable,advisories:v.via.filter(x=>typeof x==='object').map(x=>({title:x.title,url:x.url,range:x.range}))}))};
}
const visual=['visual','visual-detalhes','visual-atleta'].map(folder=>{
 const report=parse(`${dir}/${folder}/resultados.json`);
 return {folder,captures:report.captures.length,navigationChecks:report.navigationChecks,screens:report.captures.map(c=>({key:c.key,textLength:c.text.length,viewport:c.viewport,scrollWidth:c.scrollWidth,dialogs:c.dialogs,pageErrors:c.pageErrors,smallTargets:c.buttons.filter(b=>b.width<24||b.height<24).length,unnamedButtons:c.buttons.filter(b=>!b.text&&!b.label&&!b.title).length}))};
});
const core=read(`${dir}/test-core.log`);
const result={timestamp:new Date().toISOString(),corePassed:(core.match(/\[core-test\] ok:/g)||[]).length,coreFailed:(core.match(/\[core-test\] fail:/g)||[]).length,audit,visual};
fs.writeFileSync(`${dir}/resumo-verificacoes.json`,JSON.stringify(result,null,2));
const roots=['src','server/src','laines-image-processor','scripts','tests','.github/workflows','deploy'];
const files=[];
function walk(p){for(const entry of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,entry.name);if(entry.isDirectory()){if(!['node_modules','dist','__pycache__','.venv','uploads','models','jobs'].includes(entry.name))walk(f);}else if(/\.(jsx?|tsx?|css|mjs|cjs|py|yml|yaml|sh|conf|txt)$/.test(f))files.push(f);}}
roots.forEach(walk);
files.push('package.json','package-lock.json','server/package.json','server/package-lock.json','vite.config.js','docker-compose.yml','public/sw.js');
const manifest={recordedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),note:'Estado local com alterações pré-existentes; HEAD isoladamente não representa o material auditado; .env e credenciais excluídos',files:files.sort().map(p=>({file:p.replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}))};
fs.writeFileSync(`${dir}/manifesto-fontes.json`,JSON.stringify(manifest,null,2));
console.log(JSON.stringify({corePassed:result.corePassed,coreFailed:result.coreFailed,audit:Object.fromEntries(Object.entries(audit).map(([k,v])=>[k,v.metadata.vulnerabilities])),visual:visual.map(v=>({folder:v.folder,captures:v.captures,empty:v.screens.filter(s=>s.textLength<100).map(s=>s.key),navigationLimitations:v.navigationChecks.length})),hashedFiles:manifest.files.length},null,2));
