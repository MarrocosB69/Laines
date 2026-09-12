import React from 'react';

const TONS = {
  neutro: 'bg-stone-100 text-stone-600',
  ok: 'bg-emerald-50 text-emerald-800',
  atencao: 'bg-amber-50 text-amber-800'
};

export default function Etiqueta({ children, tom = 'neutro' }) {
  return <span className={`rounded px-2 py-0.5 text-xs ${TONS[tom]}`}>{children}</span>;
}
