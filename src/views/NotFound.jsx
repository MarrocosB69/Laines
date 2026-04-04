import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';

const NotFound = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/login');
  };

  return (
    <div
      className="laines-feedback-state"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem'
      }}
    >
      <h1 style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--color-text-primary)' }}>404</h1>
      <p>Página não encontrada.</p>
      <Button type="button" variant="primary" onClick={handleBack}>
        Voltar
      </Button>
    </div>
  );
};

export default NotFound;
