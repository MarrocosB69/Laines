import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error, info) {
    console.error('[LAINES] Erro de renderização:', error, info);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    const { hasError } = this.state;
    const { children } = this.props;

    if (!hasError) {
      return children;
    }

    return (
      <div className="error-boundary-shell">
        <div className="error-boundary-card" role="alert">
          <span className="error-boundary-card__icon" aria-hidden="true">⚠</span>
          <h2>Algo deu errado</h2>
          <p>Um erro inesperado ocorreu nesta seção. Você pode tentar recarregar ou voltar ao início.</p>
          <div className="error-boundary-card__actions">
            <button type="button" className="app-modal-btn app-modal-btn--primary" onClick={this.handleReload}>
              Recarregar
            </button>
            <button
              type="button"
              className="app-modal-btn app-modal-btn--secondary"
              onClick={() => { window.location.href = '/'; }}
            >
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
