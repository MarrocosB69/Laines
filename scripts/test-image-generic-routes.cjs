/* Generic image mutations must use the dedicated, consent-aware API. */
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'server/node_modules/ts-node')).register({
  project: path.join(root, 'server/tsconfig.json'),
  transpileOnly: true,
});
require(path.join(root, 'server/node_modules/reflect-metadata'));

const { AvaliacoesController } = require(path.join(root, 'server/src/avaliacoes/avaliacoes.controller.ts'));
const user = { id: 'synthetic-admin', role: 'admin' };
const request = { user };
const image = { id: 'image-id', tipo: 'composicao_corporal_imagem', pacienteId: 'patient-id' };
const clinical = { id: 'clinical-id', tipo: 'avaliacao_clinica', pacienteId: 'patient-id' };
const writes = [];
const service = {
  findById: async (id) => ({ 'image-id': image, 'clinical-id': clinical })[id] || null,
  create: async (dto) => { writes.push(['create', dto.tipo]); return dto; },
  update: async (id) => { writes.push(['update', id]); return { id }; },
  remove: async (id) => { writes.push(['remove', id]); return { id }; },
  marcarComoRevisado: async (id) => { writes.push(['revisar', id]); return { id }; },
  devolver: async (id) => { writes.push(['devolver', id]); return { id }; },
  enviarParaRevisao: async (id) => { writes.push(['enviar', id]); return { id }; },
};
const controller = new AvaliacoesController(service, {});
const isDedicatedRouteMessage = (error) => {
  assert.equal(error.status, 400);
  assert.match(error.message, /\/avaliacoes-imagem/);
  return true;
};

async function main() {
  assert.throws(
    () => controller.create(request, { tipo: 'composicao_corporal_imagem', pacienteId: 'patient-id' }),
    isDedicatedRouteMessage,
  );
  await assert.rejects(controller.update(request, 'clinical-id', { tipo: 'composicao_corporal_imagem' }), isDedicatedRouteMessage);
  await assert.rejects(controller.update(request, 'image-id', { tipo: 'avaliacao_clinica' }), isDedicatedRouteMessage);
  await assert.rejects(controller.update(request, 'image-id', { status: 'finalizada' }), isDedicatedRouteMessage);
  await assert.rejects(controller.revisar(request, 'image-id', {}), isDedicatedRouteMessage);
  await assert.rejects(controller.devolver(request, 'image-id', { observacao: 'synthetic' }), isDedicatedRouteMessage);
  await assert.rejects(controller.enviarRevisao(request, 'image-id', { observacao: 'synthetic' }), isDedicatedRouteMessage);
  await assert.rejects(controller.remove(request, 'image-id'), isDedicatedRouteMessage);
  assert.deepEqual(writes, []);

  assert.equal((await controller.findOne(request, 'image-id')).id, 'image-id');
  await controller.create(request, { tipo: 'avaliacao_clinica', pacienteId: 'patient-id' });
  await controller.update(request, 'clinical-id', { status: 'rascunho' });
  await controller.remove(request, 'clinical-id');
  assert.deepEqual(writes, [
    ['create', 'avaliacao_clinica'], ['update', 'clinical-id'], ['remove', 'clinical-id'],
  ]);
  process.stdout.write('PASS generic image mutations denied; clinical mutations and image reads preserved\n');
}

main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
