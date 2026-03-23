import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

const filesToScan = [
  'src/views/LoginPage.jsx',
  'src/components/Auth/PasswordChangeModal.jsx',
  'src/components/Avaliacoes/Antropometria/BioimpedanciaForm.jsx',
  'src/components/Avaliacoes/avaliacao-socioeconomica/AvaliacaoSocioeconomica.jsx',
  'src/components/shared/evaluationResultAdapter.js',
  'src/views/admin/Research/ResearchProjects.jsx',
  'src/views/admin/Registration/UserModal.jsx',
  'src/views/admin/Registration/PatientModal.jsx',
  'src/views/Student/Patients/PatientProntuario.jsx'
];

const forbiddenPatterns = [
  { pattern: /\u00C3[\u0080-\u00BF]/g, hint: 'possible mojibake detected' },
  { pattern: /\be necessario\b/gi, hint: 'use "e necessario" with proper accenting in UI copy' },
  { pattern: /\bSem classificacao\b/g, hint: 'replace "Sem classificacao" with accented copy' },
  { pattern: /\bNao calculado\b/g, hint: 'replace "Nao calculado" with accented copy' },
  { pattern: /\bInseguranca\b/g, hint: 'replace "Inseguranca" with accented copy' },
  { pattern: /\bPontuacao\b/g, hint: 'replace "Pontuacao" with accented copy' },
  { pattern: /\bNUTRIPRO\b/g, hint: 'legacy brand token detected in active surface' }
];

const permissionFeedbackFiles = [
  'src/views/admin/Research/ResearchProjects.jsx',
  'src/views/admin/Registration/UserModal.jsx',
  'src/views/admin/Registration/PatientModal.jsx',
  'src/views/Student/Patients/PatientProntuario.jsx'
];

const failures = [];

for (const relativePath of filesToScan) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath}: expected file not found.`);
    continue;
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  for (const { pattern, hint } of forbiddenPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      failures.push(`${relativePath}: ${hint} (${matches[0]}).`);
    }
  }
}

for (const relativePath of permissionFeedbackFiles) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const content = fs.readFileSync(absolutePath, 'utf8');
  if (!content.includes('n\u00E3o possui permiss\u00E3o')) {
    failures.push(
      `${relativePath}: default permission feedback ("nao possui permissao") not found.`
    );
  }
}

if (failures.length > 0) {
  console.error('[copy-guardrails] Copy/permission guardrails failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[copy-guardrails] Copy/permission guardrails OK.');
