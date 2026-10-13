import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import type { User as UserEntity } from '../src/users/user.entity';
let activeDataSource: import('typeorm').DataSource | null = null;

const CONFIRM_VALUE = 'CRIAR_PRINTS';
const DEFAULT_PASSWORD = 'PrintsLAINES#2026';
const PROJECT_NAME = 'Print LAINES';
const ATHLETE_PRONTUARIO = 'PRINT-000001';

type PrintUserSeed = {
  key: string;
  name: string;
  email: string;
  role: string;
  cpf: string;
  telefone: string;
  dataNascimento: string;
  matricula?: string;
  periodo?: string;
  diretoria?: string;
  curso?: string;
  crn?: string;
  conselhoTipo?: string;
  conselhoNumero?: string;
  departamento?: string;
  permissions?: string[];
};

const printUsers: PrintUserSeed[] = [
  {
    key: 'admin',
    name: 'Carlos Eduardo Mendonca',
    email: 'print.admin@laines.ufrn.br',
    role: 'admin',
    cpf: '91000000001',
    telefone: '84991000001',
    dataNascimento: '1985-03-14',
  },
  {
    key: 'coordenacao',
    name: 'Beatriz Almeida Torres',
    email: 'print.coordenacao@laines.ufrn.br',
    role: 'coordenacao',
    cpf: '91000000002',
    telefone: '84991000002',
    dataNascimento: '1990-07-22',
  },
  {
    key: 'presidente',
    name: 'Fernanda Oliveira Santos',
    email: 'print.presidente@laines.ufrn.br',
    role: 'presidente',
    cpf: '91000000003',
    telefone: '84991000003',
    dataNascimento: '1992-11-05',
    curso: 'Nutrição',
    matricula: '20221001',
    periodo: '8º',
  },
  {
    key: 'vice',
    name: 'Rafael Lima Azevedo',
    email: 'print.vice@laines.ufrn.br',
    role: 'vice',
    cpf: '91000000004',
    telefone: '84991000004',
    dataNascimento: '1993-04-18',
    curso: 'Nutrição',
    matricula: '20221002',
    periodo: '7º',
  },
  {
    key: 'marketing',
    name: 'Camila Rodrigues Pinto',
    email: 'print.marketing@laines.ufrn.br',
    role: 'aluno',
    cpf: '91000000005',
    telefone: '84991000005',
    dataNascimento: '1994-09-30',
    curso: 'Nutrição',
    matricula: '20221003',
    periodo: '6º',
    diretoria: 'Marketing e Comunicação',
  },
  {
    key: 'ensino',
    name: 'Thiago Barbosa Ferreira',
    email: 'print.ensino@laines.ufrn.br',
    role: 'aluno',
    cpf: '91000000006',
    telefone: '84991000006',
    dataNascimento: '1991-02-08',
    curso: 'Nutrição',
    matricula: '20221004',
    periodo: '8º',
    diretoria: 'Ensino e Capacitação',
  },
  {
    key: 'pesquisa',
    name: 'Juliana Nascimento Costa',
    email: 'print.pesquisa@laines.ufrn.br',
    role: 'aluno',
    cpf: '91000000007',
    telefone: '84991000007',
    dataNascimento: '1993-06-15',
    curso: 'Nutrição',
    matricula: '20221005',
    periodo: '7º',
    diretoria: 'Pesquisa e Inovação',
  },
  {
    key: 'extensao',
    name: 'Diego Sousa Martins',
    email: 'print.extensao@laines.ufrn.br',
    role: 'aluno',
    cpf: '91000000008',
    telefone: '84991000008',
    dataNascimento: '1992-12-20',
    curso: 'Nutrição',
    matricula: '20221006',
    periodo: '8º',
    diretoria: 'Extensão e Parcerias',
  },
  {
    key: 'coord_atendimento',
    name: 'Patricia Cavalcante Lima',
    email: 'print.atendimento@laines.ufrn.br',
    role: 'coord_atendimento',
    cpf: '91000000009',
    telefone: '84991000009',
    dataNascimento: '1988-05-25',
    curso: 'Nutrição',
    matricula: '20181010',
    periodo: '10º',
  },
  {
    key: 'professor',
    name: 'Anderson Vieira Melo',
    email: 'print.professor@laines.ufrn.br',
    role: 'professor',
    cpf: '91000000010',
    telefone: '84991000010',
    dataNascimento: '1978-08-03',
    crn: 'CRN-8 12345',
    conselhoTipo: 'CRN',
    conselhoNumero: '12345',
    departamento: 'Departamento de Nutrição — UFRN',
  },
  {
    key: 'profissional',
    name: 'Renata Gomes Carvalho',
    email: 'print.profissional@laines.ufrn.br',
    role: 'profissional',
    cpf: '91000000011',
    telefone: '84991000011',
    dataNascimento: '1984-01-17',
    crn: 'CRN-8 54321',
    conselhoTipo: 'CRN',
    conselhoNumero: '54321',
    departamento: 'Nutrição Esportiva',
  },
  {
    key: 'pesquisador',
    name: 'Marcos Pereira Ribeiro',
    email: 'print.pesquisador@laines.ufrn.br',
    role: 'pesquisador',
    cpf: '91000000012',
    telefone: '84991000012',
    dataNascimento: '1980-10-11',
    departamento: 'Pesquisa Clínica',
  },
  {
    key: 'colaborador',
    name: 'Isabela Fonseca Araujo',
    email: 'print.colaborador@laines.ufrn.br',
    role: 'colaborador',
    cpf: '91000000013',
    telefone: '84991000013',
    dataNascimento: '1995-03-07',
    departamento: 'Colaboração Externa',
  },
  {
    key: 'tecnico',
    name: 'Rodrigo Santos Bezerra',
    email: 'print.tecnico@laines.ufrn.br',
    role: 'tecnico',
    cpf: '91000000014',
    telefone: '84991000014',
    dataNascimento: '1987-07-29',
    departamento: 'Equipe Técnica',
  },
  {
    key: 'aluno',
    name: 'Ana Carolina Medeiros Silva',
    email: 'print.aluno@laines.ufrn.br',
    role: 'aluno',
    cpf: '91000000015',
    telefone: '84991000015',
    dataNascimento: '2002-09-14',
    matricula: '20230050',
    periodo: '5º',
    curso: 'Nutrição',
  },
  {
    key: 'atleta',
    name: 'Lucas Gabriel Cunha',
    email: 'print.atleta@laines.ufrn.br',
    role: 'atleta',
    cpf: '91000000016',
    telefone: '84991000016',
    dataNascimento: '2001-06-12',
  },
];

const requireConfirmation = () => {
  if (process.env.PRINT_SCREENSHOT_SEED_CONFIRM !== CONFIRM_VALUE) {
    throw new Error(`Defina PRINT_SCREENSHOT_SEED_CONFIRM=${CONFIRM_VALUE} para criar usuarios temporarios de print.`);
  }
};

async function main() {
  requireConfirmation();
  const password = String(process.env.PRINT_SCREENSHOT_PASSWORD || DEFAULT_PASSWORD);
  const passwordHash = await bcrypt.hash(password, 10);
  const { default: dataSource } = await import('../src/database/typeorm.config');
  const { User } = await import('../src/users/user.entity');
  const { Projeto } = await import('../src/projetos/projeto.entity');
  const { Paciente } = await import('../src/pacientes/paciente.entity');
  activeDataSource = dataSource;

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  await dataSource.transaction(async (manager) => {
    const usersRepo = manager.getRepository(User);
    const projetosRepo = manager.getRepository(Projeto);
    const pacientesRepo = manager.getRepository(Paciente);

    let projeto = await projetosRepo.findOne({ where: { nome: PROJECT_NAME } });
    if (!projeto) {
      projeto = projetosRepo.create({
        nome: PROJECT_NAME,
        area: 'nutricao',
        status: 'em_andamento',
        descricao: 'Projeto temporario para capturas de tela.',
        equipe: [],
        alunosIds: [],
        alunosNomes: []
      });
    } else {
      projeto.status = 'em_andamento';
      projeto.descricao = 'Projeto temporario para capturas de tela.';
    }
    projeto = await projetosRepo.save(projeto);

    const savedUsers = new Map<string, UserEntity>();
    for (const item of printUsers) {
      let user = await usersRepo.findOne({ where: { email: item.email } });
      if (!user) {
        user = usersRepo.create();
      }
      user.email = item.email;
      user.passwordHash = passwordHash;
      user.name = item.name;
      user.role = item.role;
      user.cpf = item.cpf;
      user.telefone = item.telefone;
      user.dataNascimento = item.dataNascimento;
      user.status = 'ativo';
      user.mustChangePassword = false;
      user.tempPassword = null;
      user.passwordUpdatedAt = new Date();
      user.sessionVersion = Number(user.sessionVersion || 1);
      user.projetoId = projeto.id;
      user.projetoNome = projeto.nome;
      user.departamento = item.departamento ?? 'Prints';
      user.nivelAcesso = 'temporario';
      user.coordAtendimento = item.role === 'coord_atendimento';
      user.diretoria = item.diretoria ?? null;
      user.permissions = item.permissions ?? [];

      if (item.matricula) user.matricula = item.matricula;
      if (item.periodo) user.periodo = item.periodo;
      if (item.curso) user.curso = item.curso;
      if (item.crn) user.crn = item.crn;
      if (item.conselhoTipo) user.conselhoTipo = item.conselhoTipo;
      if (item.conselhoNumero) user.conselhoNumero = item.conselhoNumero;

      savedUsers.set(item.key, await usersRepo.save(user));
    }

    const professor = savedUsers.get('professor');
    const tecnico = savedUsers.get('tecnico');
    const atleta = savedUsers.get('atleta');
    const studentKeys = ['presidente', 'vice', 'marketing', 'ensino', 'pesquisa', 'extensao', 'aluno'];
    const students = studentKeys
      .map((key) => savedUsers.get(key))
      .filter((user): user is UserEntity => Boolean(user));
    const aluno = savedUsers.get('aluno');
    if (!professor || !aluno || !tecnico || !atleta) {
      throw new Error('Falha ao resolver usuarios base para vinculos de print.');
    }

    for (const student of students) {
      student.supervisorId = professor.id;
      student.supervisorNome = professor.name;
      student.projetoId = projeto.id;
      student.projetoNome = projeto.nome;
    }
    await usersRepo.save(students);

    projeto.coordenador = professor.name;
    projeto.coordenadorId = professor.id;
    projeto.equipe = [professor.name, tecnico.name];
    projeto.alunosIds = students.map((student) => student.id);
    projeto.alunosNomes = students.map((student) => student.name);
    await projetosRepo.save(projeto);

    let paciente = await pacientesRepo.findOne({ where: { prontuario: ATHLETE_PRONTUARIO } });
    if (!paciente) {
      paciente = pacientesRepo.create({ prontuario: ATHLETE_PRONTUARIO });
    }
    paciente.nome = 'Lucas Gabriel Cunha';
    paciente.cpf = '92000000001';
    paciente.dataNascimento = '2001-06-12';
    paciente.genero = 'masculino';
    paciente.telefone = '84999000001';
    paciente.email = atleta.email;
    paciente.endereco = 'Rua das Dunas, 142, Apto 301';
    paciente.bairro = 'Lagoa Nova';
    paciente.cidade = 'Natal';
    paciente.estado = 'RN';
    paciente.status = 'Ativo';
    paciente.modalidadePrincipal = 'Natacao';
    paciente.outrasModalidades = 'Musculação, Ciclismo';
    paciente.tempoPratica = '5 anos';
    paciente.frequenciaSemanal = 6;
    paciente.duracaoSessao = 120;
    paciente.tipoTreino = 'aerobio';
    paciente.intensidade = 'alta';
    paciente.objetivo = 'performance';
    paciente.observacoes = 'Atleta de alto rendimento em preparação para campeonato estadual. Histórico de câimbras frequentes em treinos longos.';
    paciente.historicoSaude = 'Sem comorbidades relevantes. Fratura no tornozelo direito em 2022, totalmente recuperado. Alergias: nenhuma. Medicamentos em uso: nenhum.';
    paciente.comorbidadesPessoais = [];
    paciente.comorbidadesFamiliares = ['hipertensao_arterial'];
    paciente.confirmacaoAtleta = { confirmado: true, data: '2026-01-15', responsavel: aluno.name };
    paciente.projetoId = projeto.id;
    paciente.projetoNome = projeto.nome;
    paciente.alunoResponsavelId = aluno.id;
    paciente.alunoResponsavelNome = aluno.name;
    paciente.professorSupervisorId = professor.id;
    paciente.professorSupervisorNome = professor.name;
    paciente.equipeTecnicaIds = [tecnico.id];
    paciente.atletaUserId = atleta.id;
    paciente.consentimentoPesquisa = 'aprovado';
    paciente.consentimentoData = new Date().toISOString().slice(0, 10);
    paciente.consentimentoVersao = 'prints-1.0';
    paciente.dataCadastro = new Date();
    paciente.linkedAt = new Date();
    await pacientesRepo.save(paciente);

    console.log(`[seed-print-users] projeto: ${projeto.nome} (${projeto.id})`);
    console.log(`[seed-print-users] senha comum: ${password}`);
    for (const item of printUsers) {
      const scope = item.diretoria ? `${item.role}/${item.diretoria}` : item.role;
      console.log(`[seed-print-users] ${item.key} (${scope}): ${item.email}`);
    }
  });
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[seed-print-users] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (activeDataSource?.isInitialized) {
      await activeDataSource.destroy();
    }
  });
