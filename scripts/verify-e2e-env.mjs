const isCi = /^(1|true)$/i.test(String(process.env.CI || ''));
const requireRoleMatrix = /^(1|true)$/i.test(String(process.env.E2E_ROLE_MATRIX_REQUIRED || ''));

const hasValue = (name) => String(process.env[name] || '').trim().length > 0;

const required = [
  ['E2E_ADMIN_EMAIL', 'Credencial de email admin'],
  ['E2E_ADMIN_PASSWORD', 'Credencial de senha admin']
];

if (requireRoleMatrix) {
  required.push(
    ['E2E_STUDENT_EMAIL', 'Credencial de email aluno'],
    ['E2E_STUDENT_PASSWORD', 'Credencial de senha aluno'],
    ['E2E_PROFESSOR_EMAIL', 'Credencial de email professor'],
    ['E2E_PROFESSOR_PASSWORD', 'Credencial de senha professor'],
    ['E2E_TEAM_EMAIL', 'Credencial de email equipe tecnica'],
    ['E2E_TEAM_PASSWORD', 'Credencial de senha equipe tecnica'],
    ['E2E_ATHLETE_EMAIL', 'Credencial de email atleta'],
    ['E2E_ATHLETE_PASSWORD', 'Credencial de senha atleta']
  );
}

const missing = required
  .filter(([name]) => !hasValue(name))
  .map(([name, label]) => `${name} (${label})`);

if (missing.length > 0) {
  const message = `[e2e-env] Variaveis ausentes: ${missing.join(', ')}`;
  if (isCi) {
    console.error(`${message}.`);
    process.exit(1);
  }
  console.log(`${message}.`);
  console.log('[e2e-env] Ambiente local: validacao nao bloqueante.');
  process.exit(0);
}

console.log('[e2e-env] Credenciais E2E validadas com sucesso.');
