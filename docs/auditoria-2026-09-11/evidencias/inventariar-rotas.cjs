const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'server/node_modules/typescript'));
const routes=[];
function decorators(node){return (ts.canHaveDecorators(node)?ts.getDecorators(node):[])||[];}
function decInfo(node){return decorators(node).map(d=>{const e=d.expression;return {name:ts.isCallExpression(e)?e.expression.getText():e.getText(),args:ts.isCallExpression(e)?e.arguments.map(a=>ts.isStringLiteral(a)?a.text:a.getText()):[]};});}
function visitDir(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())visitDir(f);else if(e.name.endsWith('.controller.ts')){
 const source=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true);
 for(const cls of source.statements.filter(ts.isClassDeclaration)){
   const classDec=decInfo(cls);const controller=classDec.find(d=>d.name==='Controller');if(!controller)continue;
   for(const method of cls.members.filter(ts.isMethodDeclaration)){
     const methodDec=decInfo(method);const verbs=methodDec.filter(d=>['Get','Post','Put','Patch','Delete','Options','Head','All'].includes(d.name));
     for(const v of verbs){routes.push({method:v.name.toUpperCase(),route:'/'+[controller.args[0],v.args[0]].filter(Boolean).join('/'),handler:method.name.getText(),file:path.relative(root,f).replaceAll('\\','/'),line:source.getLineAndCharacterOfPosition(method.getStart()).line+1,classDecorators:classDec.filter(d=>d.name!=='Controller'),methodDecorators:methodDec.filter(d=>!verbs.includes(d))});}
   }
 }
}}}
visitDir(path.join(root,'server/src'));
routes.sort((a,b)=>a.route.localeCompare(b.route)||a.method.localeCompare(b.method));
const seen=new Set();const duplicates=[];for(const r of routes){const k=r.method+' '+r.route;if(seen.has(k))duplicates.push(k);seen.add(k);}
const out=path.join(root,'docs/auditoria-2026-09-11');
fs.writeFileSync(path.join(out,'evidencias/rotas-api.json'),JSON.stringify({generatedAt:new Date().toISOString(),method:'AST TypeScript: apenas decoradores declarados; não resolve autorização interna de serviços',routeCount:routes.length,duplicates,routes},null,2));
const rows=routes.map(r=>{const guards=[...r.classDecorators,...r.methodDecorators].filter(d=>d.name==='UseGuards').flatMap(d=>d.args);return '| '+[r.method,'`'+r.route+'`',guards.join(', ')||'Não declarado no controller','`'+r.file+':'+r.line+'`'].join(' | ')+' |';});
fs.writeFileSync(path.join(out,'rotas-api.md'),'# Inventário estático atual de rotas da API\n\nGerado por AST TypeScript, sem executar a API. '+routes.length+' entradas de rota; '+duplicates.length+' duplicidades exatas de método/caminho encontradas.\n\nEste inventário não classifica uma rota como segura/insegura. Guard declarado é apenas uma camada; permissões, vínculo, projeção de campos e efeitos antes da autorização precisam ser lidos no serviço/interceptor. A ausência de guard pode ser intencional em endpoints públicos. Os decoradores completos estão em [rotas-api.json](evidencias/rotas-api.json). Não inclui URLs assinadas geradas dinamicamente nem rotas internas do processador Python.\n\n| Método | Caminho | Guards declarados na classe/método | Fonte |\n|---|---|---|---|\n'+rows.join('\n')+'\n');
console.log(JSON.stringify({routeCount:routes.length,duplicates}));
