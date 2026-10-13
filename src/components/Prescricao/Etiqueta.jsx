import React from 'react';

const TONS = {
  neutro: 'pp-etiqueta--neutro',
  ok: 'pp-etiqueta--ok',
  atencao: 'pp-etiqueta--atencao'
};

export default function Etiqueta({ children, tom = 'neutro' }) {
  return <span className={`pp-etiqueta ${TONS[tom]}`}>{children}</span>;
}
