import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Divergências entre o que o atleta declarou e o que a equipe registrou.
 *
 * As duas fontes já apareciam na mesma aba, corretamente rotuladas — mas
 * longe uma da outra e sem sinal nenhum de que discordavam. Um atleta que
 * nega diagnóstico e consta como diabético no prontuário é exatamente o caso
 * em que a tela precisa avisar, e ela apenas mostrava os dois lados.
 *
 * Não escolhe um lado: aponta que existem dois.
 */
export default function PainelDivergencias({ divergencias = [] }) {
  if (divergencias.length === 0) return null;

  return (
    <section className="pron-card pron-panel pron-divergencias" aria-labelledby="divergencias-titulo">
      <header className="pron-divergencias__topo">
        <AlertTriangle size={16} aria-hidden="true" />
        <div>
          <h2 id="divergencias-titulo">
            {divergencias.length === 1
              ? 'O que o atleta declarou não bate com o registro'
              : `${divergencias.length} divergências entre autorrelato e registro`}
          </h2>
          <p>Duas fontes discordam sobre a mesma pergunta. Nenhuma foi escolhida.</p>
        </div>
      </header>

      <ul className="pron-divergencias__lista">
        {divergencias.map((d) => (
          <li key={d.id}>
            <p className="pron-divergencias__rotulo">{d.rotulo}</p>
            <div className="pron-divergencias__lados">
              <div>
                <span>Declarado pelo atleta</span>
                {d.declarado}
              </div>
              <div>
                <span>Registro da equipe</span>
                {d.registrado}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
