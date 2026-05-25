import 'dotenv/config';
import dataSource from '../typeorm.config';
import { Met, MetsCategoria, MetsIntensidade } from '../../mets/mets.entity';

type DefinicaoMet = {
  modalidade: string;
  categoria: MetsCategoria;
  valores: Partial<Record<MetsIntensidade, number>>;
};

const DEFINICOES_BASE: DefinicaoMet[] = [
  { modalidade: 'futebol', categoria: MetsCategoria.COLETIVO, valores: { leve: 5.0, moderada: 7.0, vigorosa: 10.0, maxima: 12.0 } },
  { modalidade: 'natacao', categoria: MetsCategoria.AQUATICO, valores: { leve: 5.8, moderada: 8.3, vigorosa: 10.0, maxima: 13.0 } },
  { modalidade: 'musculacao', categoria: MetsCategoria.FORCA, valores: { leve: 3.5, moderada: 5.0, vigorosa: 6.0, maxima: 8.0 } },
  { modalidade: 'corrida', categoria: MetsCategoria.ENDURANCE, valores: { leve: 6.0, moderada: 9.8, vigorosa: 11.5, maxima: 14.0 } },
  { modalidade: 'ciclismo', categoria: MetsCategoria.ENDURANCE, valores: { leve: 5.5, moderada: 8.0, vigorosa: 10.0, maxima: 14.0 } },
  { modalidade: 'basquete', categoria: MetsCategoria.COLETIVO, valores: { leve: 6.5, moderada: 8.0, vigorosa: 10.0 } },
  { modalidade: 'volei', categoria: MetsCategoria.COLETIVO, valores: { leve: 4.0, moderada: 6.0, vigorosa: 8.0 } },
  { modalidade: 'luta_mma', categoria: MetsCategoria.COMBATE, valores: { leve: 5.0, moderada: 8.0, vigorosa: 12.0 } },
  { modalidade: 'tenis', categoria: MetsCategoria.OUTRO, valores: { leve: 4.5, moderada: 7.0, vigorosa: 9.0 } },
  { modalidade: 'handebol', categoria: MetsCategoria.COLETIVO, valores: { leve: 6.0, moderada: 8.0, vigorosa: 10.0 } },
  { modalidade: 'atletismo_salto', categoria: MetsCategoria.ENDURANCE, valores: { leve: 5.0, moderada: 8.0, vigorosa: 11.0 } },
  { modalidade: 'atletismo_arremesso', categoria: MetsCategoria.FORCA, valores: { leve: 4.0, moderada: 5.5, vigorosa: 7.0 } },
  { modalidade: 'ciclismo_indoor', categoria: MetsCategoria.ENDURANCE, valores: { leve: 5.0, moderada: 8.5, vigorosa: 11.0, maxima: 14.0 } },
  { modalidade: 'remo', categoria: MetsCategoria.ENDURANCE, valores: { leve: 5.5, moderada: 8.5, vigorosa: 12.0, maxima: 15.0 } },
  { modalidade: 'alongamento_yoga', categoria: MetsCategoria.OUTRO, valores: { leve: 2.0, moderada: 2.5, vigorosa: 3.0 } },
  { modalidade: 'caminhada', categoria: MetsCategoria.ENDURANCE, valores: { leve: 2.5, moderada: 3.5, vigorosa: 4.5 } },
  { modalidade: 'descanso_ativo', categoria: MetsCategoria.OUTRO, valores: { leve: 1.5 } },

  // Complemento para cobertura do catalogo (>= 60 linhas)
  { modalidade: 'futsal', categoria: MetsCategoria.COLETIVO, valores: { leve: 5.2, moderada: 7.2, vigorosa: 10.2, maxima: 12.2 } },
  { modalidade: 'triatlo', categoria: MetsCategoria.ENDURANCE, valores: { leve: 6.5, moderada: 9.0, vigorosa: 11.5, maxima: 14.5 } },
  { modalidade: 'crossfit', categoria: MetsCategoria.FORCA, valores: { leve: 5.0, moderada: 7.0, vigorosa: 10.0, maxima: 12.0 } },
  { modalidade: 'rugby', categoria: MetsCategoria.COLETIVO, valores: { leve: 6.0, moderada: 8.8, vigorosa: 11.0, maxima: 13.0 } }
];

const INTENSIDADES = [
  MetsIntensidade.LEVE,
  MetsIntensidade.MODERADA,
  MetsIntensidade.VIGOROSA,
  MetsIntensidade.MAXIMA
];

const buildSeedRows = () => DEFINICOES_BASE.flatMap((definicao) => (
  INTENSIDADES
    .map((intensidade) => {
      const metValue = definicao.valores[intensidade];
      if (!Number.isFinite(metValue)) return null;
      return {
        modalidade: definicao.modalidade,
        categoria: definicao.categoria,
        intensidade,
        metValue: Number((metValue as number).toFixed(1)).toString(),
        fonte: 'Ainsworth 2011',
        codigoAinsworth: `${definicao.modalidade}-${intensidade}`.toLowerCase()
      };
    })
    .filter((item): item is {
      modalidade: string;
      categoria: MetsCategoria;
      intensidade: MetsIntensidade;
      metValue: string;
      fonte: string;
      codigoAinsworth: string;
    } => Boolean(item))
));

async function main() {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const repo = dataSource.getRepository(Met);
  const payload = buildSeedRows();
  await repo.upsert(payload, ['modalidade', 'categoria', 'intensidade']);

  console.log(`[mets-seed] registros upsertados: ${payload.length}`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mets-seed] falha: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });
