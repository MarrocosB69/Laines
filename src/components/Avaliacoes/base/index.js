// Base comum dos formulários de avaliação (onda "avaliações v2").
// Contrato: docs/implementacao/avaliacoes-v2/contrato-avaliacao.md.
// Importar daqui já carrega avaliacao-base.css.
import './avaliacao-base.css';

export { AvaliacaoModulo, AvaliacaoSecao, AvaliacaoIndice } from './AvaliacaoModulo';
export { Campo, CampoNumero, GrupoOpcoes, Opcao } from './Campo';
export { ResultadoCalculado, AvisoAvaliacao, BarraAcoesAvaliacao } from './Resultado';
export { Dica } from './Dica';
export { Tendencia } from './Tendencia';
export { normalizarTom, valorAusente, idTituloSecao } from './apoio';
