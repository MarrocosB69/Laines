import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Auditoria visual do código atual com API interceptada e dados sintéticos.
// Não é evidência de integração nem de autorização do servidor.
const focused = process.argv.includes('--focused');
const completed = process.argv.includes('--completed');
const out = path.resolve('docs/auditoria-2026-09-11/evidencias', completed ? 'visual-atleta' : focused ? 'visual-detalhes' : 'visual');
await fs.mkdir(out, { recursive: true });
const uid = '11111111-1111-4111-8111-111111111111';
const pid = '22222222-2222-4222-8222-222222222222';
const projectId = '33333333-3333-4333-8333-333333333333';
const patient = {
  id: pid, nome: 'Atleta Demonstração', prontuario: 'AUD-001', cpf: '00000000000',
  email: 'atleta@example.invalid', telefone: '00000000000', dataNascimento: '2001-03-15',
  genero: 'Feminino', sexoBiologico: 'feminino', modalidadePrincipal: 'Corrida',
  objetivo: 'Acompanhamento nutricional', status: 'ativo', peso: 62, pesoAtual: 62,
  altura: 168, alunoResponsavelId: uid, alunoResponsavelNome: 'Aluno Demonstração',
  professorSupervisorId: uid, professorSupervisorNome: 'Professor Demonstração',
  equipeTecnicaIds: [uid], equipeMultiIds: [uid], atletaUserId: uid,
  projetoId: projectId, projetoNome: 'Projeto Demonstração', createdAt: '2026-08-01T12:00:00Z',
  dataCadastro: '2026-08-01T12:00:00Z', onboardingConcluido: true,
  anamnese: {}, historicoSaude: {}, anexos: [], mensagensProfessor: [],
  ...(completed ? {confirmacaoAtleta:{completed:true,completadoEm:'2026-08-01T12:00:00Z'}} : {}),
};
const project = {id: projectId, nome:'Projeto Demonstração', area:'nutricao', status:'ativo', descricao:'Atividades de ensino, pesquisa e extensão da liga.', coordenador:'Professor Demonstração', coordenadorId:uid, alunosIds:[uid], alunosNomes:['Aluno Demonstração'], equipe:['Professor Demonstração']};
const userFor = (role, diretoria = '') => ({id:uid, uid, name:'Pessoa Demonstração', email:'auditoria@example.invalid', role, diretoria, permissions:[], cpf:'00000000000', telefone:'00000000000', dataNascimento:'2000-01-01', matricula:'AUD-001', curso:'Nutrição', periodo:'6', supervisorId:uid, supervisorNome:'Professor Demonstração', projetoId:projectId, projetoNome:project.nome, ativo:true, mustChangePassword:false});
const browser = await chromium.launch({headless:true});
const report = {generatedAt:new Date().toISOString(), mode:'Frontend real em dev; API interceptada; dados sintéticos; sem teste de backend', captures:[], requests:[], navigationChecks:[]};
const slug = v => v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase().replace(/^-|-$/g,'');
async function capture(page, key, errors) {
  await page.waitForFunction(() => document.body.innerText.trim().length > 100 && !document.querySelector('#root > .skeleton'), undefined, {timeout:60000});
  await page.waitForTimeout(350);
  const metrics = await page.evaluate(() => {
    const visible = el => {const r=el.getBoundingClientRect(); const s=getComputedStyle(el); return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none';};
    const buttons=[...document.querySelectorAll('button')].filter(visible);
    return {url:location.pathname, title:document.title, viewport:{width:innerWidth,height:innerHeight}, scrollWidth:document.documentElement.scrollWidth, scrollHeight:document.documentElement.scrollHeight,
      headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).map(el=>el.innerText),
      buttons:buttons.map(el=>({text:el.innerText.trim(),label:el.getAttribute('aria-label'),title:el.title,width:Math.round(el.getBoundingClientRect().width),height:Math.round(el.getBoundingClientRect().height),disabled:el.disabled})),
      text:document.body.innerText, dialogs:[...document.querySelectorAll('[role="dialog"]')].filter(visible).length,
      tables:[...document.querySelectorAll('table')].map(el=>({headers:[...el.querySelectorAll('th')].map(th=>th.innerText),caption:el.caption?.innerText||'',width:el.getBoundingClientRect().width})),
      images:[...document.images].filter(visible).map(el=>({alt:el.alt,loaded:el.complete&&el.naturalWidth>0})),
      overflow:[...document.querySelectorAll('main *,[role="main"] *')].filter(visible).filter(el=>el.getBoundingClientRect().right>innerWidth+2).slice(0,12).map(el=>({tag:el.tagName,class:el.className?.baseVal??el.className,text:el.innerText?.slice(0,60)}))};
  });
  const file=slug(key)+'.png';
  await page.screenshot({path:path.join(out,file),fullPage:true,animations:'disabled',timeout:30000});
  report.captures.push({key,file,...metrics,pageErrors:[...errors]});
  await fs.writeFile(path.join(out,'resultados.json'), JSON.stringify(report,null,2));
  console.log(JSON.stringify({key,route:metrics.url,width:metrics.scrollWidth,height:metrics.scrollHeight,dialogs:metrics.dialogs,errors:errors.length}));
}
async function contextFor(role, viewport, diretoria='') {
  const context=await browser.newContext({viewport,serviceWorkers:'block'});
  const user=userFor(role,diretoria);
  await context.route('**/*', async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/api/')) {
      const p=url.pathname.slice(4); let body=[]; let status=200;
      report.requests.push({role,path:p,method:route.request().method()});
      if(p==='/auth/me') {body=user; if(role==='public'){body={message:'Unauthorized'};status=401;}}
      else if(p==='/auth/refresh'){body={message:'Unauthorized'};status=401;}
      else if(p==='/pacientes') body=[patient];
      else if(p===`/pacientes/${pid}`) body=patient;
      else if(p.endsWith('/onboarding-status')) body={complete:true,concluido:true,pendingFields:[]};
      else if(p==='/users'||p==='/auth/supervisors') body=[userFor('aluno'),{...userFor('professor'),name:'Professor Demonstração'}];
      else if(p==='/projetos'||p==='/projetos/public') body=[project];
      else if(p.endsWith('/contexto')) body={paciente:patient,metas:{kcal:2200,cho:275,ptn:110,lip:73,fibra:30}};
      else if(p==='/planos-alimentares') body={itens:[],total:0,limit:1,offset:0};
      else if(p==='/settings/admin-console') body={};
      else if(p.startsWith('/analytics/')) body={};
      else if(p.startsWith('/avaliacoes/pendencias/')) body={pendencias:[],total:0};
      else if(p==='/taco/buscar') body=[{id:'audit-rice',nome:'Arroz cozido',descricao:'Arroz cozido',energia:128,proteina:2.5,carboidrato:28.1,lipideos:0.2,fibraAlimentar:1.6,grupo:'Cereais e derivados',fonte:'TACO',porcaoBase:100}];
      else if(route.request().method()!=='GET'){status=405;body={message:'Auditoria visual não persiste alterações'};}
      return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    }
    if(!['127.0.0.1','localhost'].includes(url.hostname))return route.abort();
    return route.continue();
  });
  const page=await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(30000);
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.body.innerText.length>100,undefined,{timeout:60000});
  await page.waitForTimeout(800);
  return {context,page,errors};
}
try {
 for (const [size,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]) {
  for(const role of (completed ? ['atleta'] : focused ? ['public','aluno','atleta'] : ['public','aluno','admin','professor','tecnico','atleta'])) {
   const {context,page,errors}=await contextFor(role,viewport);
   try {
    await capture(page,`${size}-${role}-inicio`,errors);
    if(size==='mobile') {await page.keyboard.press('Escape');await capture(page,`${size}-${role}-menu-fechado`,errors);}
    if(!focused && size==='desktop'&&['aluno','admin','professor','atleta'].includes(role)) {
      const labels=await page.locator('aside .laines-sidebar__item').evaluateAll(els=>els.map(el=>el.textContent.trim()).filter(Boolean));
      for(const label of [...new Set(labels)].slice(0,12)) {
        const item=page.locator('aside .laines-sidebar__item').filter({hasText:label}).first();
        if(await item.isVisible()) {
          try {await item.click(); await page.waitForTimeout(600); await capture(page,`${size}-${role}-${label}`,errors);}
          catch(e){report.navigationChecks.push({role,label,error:e.message.slice(0,160)});}
        }
      }
    }
    if(role==='aluno') {
      await page.goto(`http://127.0.0.1:5173/prescricao-plano/${pid}`,{waitUntil:'domcontentloaded'});
      await page.getByRole('button',{name:'Salvar plano',exact:true}).waitFor({timeout:60000});
      await page.waitForTimeout(1800);
      await capture(page,`${size}-prescricao`,errors);
      await page.goto('http://127.0.0.1:5173/aluno',{waitUntil:'domcontentloaded'});
      await page.waitForTimeout(700);
      const athlete=page.getByText('Atleta Demonstração',{exact:true}).first();
      await athlete.waitFor({timeout:60000});
      if(await athlete.isVisible()) {await athlete.click();await page.waitForTimeout(900);await capture(page,`${size}-prontuario`,errors);}
    }
   } catch(e){report.navigationChecks.push({role,size,error:e.message});}
   await context.close();
  }
 }
 // Fluxo acadêmico do aluno sem vínculo e do integrante de diretoria.
 for(const diretoria of (focused || completed ? [] : ['diretoria_ensino','diretoria_marketing'])){
   const {context,page,errors}=await contextFor('aluno',{width:1440,height:900},diretoria);
   await capture(page,`desktop-aluno-${diretoria}`,errors);
   await context.close();
 }
} finally {
 await fs.writeFile(path.join(out,'resultados.json'),JSON.stringify(report,null,2));
 await browser.close();
}
