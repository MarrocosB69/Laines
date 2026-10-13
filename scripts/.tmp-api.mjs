import { chromium } from 'playwright';
const BASE='http://localhost:5173'; const OUT=process.env.OUT;
const PAC='1bf05737-dc5b-40dd-97f9-003940adfd6b';
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:1300,height:1000}})).newPage();
const erros=[]; p.on('pageerror',e=>erros.push(String(e).slice(0,180)));
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'});
await p.locator('input[autocomplete="username"]').fill('print.aluno@laines.ufrn.br');
await p.locator('input[type="password"]').fill('PrintsLAINES#2026');
await p.locator('form button[type="submit"]').click();
await p.waitForURL(/\/aluno/,{timeout:20000}); await p.waitForTimeout(2000);

await p.goto(`${BASE}/prescricao-plano/${PAC}`,{waitUntil:'domcontentloaded'});
await p.waitForSelector('table, .prescricao-plano', {timeout:25000});
await p.waitForTimeout(3500);
console.log('paciente na tela:', (await p.locator('.prescricao-plano p').first().innerText().catch(()=>'-')).slice(0,40));
console.log('meta energetica  :', await p.evaluate(() => {
  const th = [...document.querySelectorAll('th[scope=row]')].find(e=>/Energia/.test(e.textContent));
  return th ? th.parentElement.children[2]?.textContent.trim() : 'nao achou';
}));
// adicionar alimento real
const add = p.locator('button:has-text("Adicionar alimento")').first();
console.log('botao adicionar:', await add.count());
if (await add.count()) {
  await add.click(); await p.waitForTimeout(700);
  await p.locator('#busca-alimento').fill('feijao'); await p.waitForTimeout(2600);
  const r = p.locator('.prescricao-plano ul li button');
  console.log('resultados p/ "feijao" (sem acento):', await r.count());
  if (await r.count()) { await r.first().click(); await p.waitForTimeout(1500); }
}
console.log('itens na refeicao:', await p.locator('tbody tr').count());
console.log('total do dia:', (await p.locator('text=/carga glic/').first().innerText().catch(()=>'-')));
console.log('erros:', erros.length?[...new Set(erros)].slice(0,2):'nenhum');
// salvar e reabrir
const antes = await p.locator('text=/carga glic/').first().innerText();
await p.locator('button:has-text("Salvar plano")').click();
await p.waitForTimeout(3000);
console.log('marcador de salvo:', await p.locator('text=salvo').count() ? 'apareceu' : 'NAO apareceu');
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForSelector('table, .prescricao-plano', { timeout: 25000 });
await p.waitForTimeout(3500);
const depois = await p.locator('text=/carga glic/').first().innerText().catch(()=>'-');
console.log('apos recarregar :', depois.replace(/\s+/g,' '));
console.log('persistiu       :', antes.replace(/\s+/g,' ') === depois.replace(/\s+/g,' ') ? 'SIM' : 'nao (' + antes.replace(/\s+/g,' ') + ')');
console.log('itens apos reload:', await p.locator('tbody tr').count());
await p.screenshot({ path: `${OUT}/api-real.png`, fullPage: false });
await b.close();
