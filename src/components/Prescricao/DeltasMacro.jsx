import React from 'react';
import { sinal } from './formato.js';

export default function DeltasMacro({ op }) {
  return (
    <span className="text-stone-400">
      C {sinal(op.deltaCho)} · P {sinal(op.deltaPtn)} · L {sinal(op.deltaLip)}
      {op.deltaCg !== null && <> · CG {sinal(op.deltaCg)}</>}
    </span>
  );
}
