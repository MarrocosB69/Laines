import 'dotenv/config';

let activeDataSource: import('typeorm').DataSource | null = null;

const CONFIRM_VALUE = 'REMOVER_PRINTS';
const PROJECT_NAME = 'Print LAINES';
const ATHLETE_PRONTUARIO = 'PRINT-000001';

const requireConfirmation = () => {
  if (process.env.PRINT_SCREENSHOT_CLEANUP_CONFIRM !== CONFIRM_VALUE) {
    throw new Error(`Defina PRINT_SCREENSHOT_CLEANUP_CONFIRM=${CONFIRM_VALUE} para remover usuarios temporarios de print.`);
  }
};

async function main() {
  requireConfirmation();
  const { default: dataSource } = await import('../src/database/typeorm.config');
  activeDataSource = dataSource;

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  await dataSource.transaction(async (manager) => {
    const patientRows = await manager.query(
      'SELECT id FROM pacientes WHERE prontuario = $1 OR email LIKE $2',
      [ATHLETE_PRONTUARIO, 'print.%@laines.ufrn.br']
    );
    const patientIds = patientRows.map((row: { id: string }) => row.id);

    if (patientIds.length > 0) {
      await manager.query('DELETE FROM planos_alimentares WHERE paciente_id = ANY($1::uuid[])', [patientIds]).catch(() => undefined);
      await manager.query('DELETE FROM agendamentos WHERE paciente_id = ANY($1::uuid[])', [patientIds]);
      await manager.query('DELETE FROM avaliacoes WHERE paciente_id = ANY($1::uuid[])', [patientIds]);
      await manager.query('DELETE FROM pacientes WHERE id = ANY($1::uuid[])', [patientIds]);
    }

    const userRows = await manager.query(
      'SELECT id FROM users WHERE email LIKE $1',
      ['print.%@laines.ufrn.br']
    );
    const userIds = userRows.map((row: { id: string }) => row.id);
    if (userIds.length > 0) {
      await manager.query('DELETE FROM notificacoes WHERE user_id = ANY($1::uuid[])', [userIds]);
      await manager.query('DELETE FROM refresh_tokens WHERE user_id = ANY($1::uuid[])', [userIds]).catch(() => undefined);
      await manager.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    }

    await manager.query('DELETE FROM projetos WHERE nome = $1', [PROJECT_NAME]);

    console.log(`[cleanup-print-users] pacientes removidos: ${patientIds.length}`);
    console.log(`[cleanup-print-users] usuarios removidos: ${userIds.length}`);
    console.log(`[cleanup-print-users] projeto removido: ${PROJECT_NAME}`);
  });
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cleanup-print-users] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (activeDataSource?.isInitialized) {
      await activeDataSource.destroy();
    }
  });
