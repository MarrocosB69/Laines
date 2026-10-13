import React from 'react';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import Skeleton from './Skeleton';

const FeedbackState = ({
  loading = false,
  error = false,
  icon: CustomIcon,
  title,
  description,
  action,
  onAction,
  onRetry,
  size = 'md',
  skeletonLines = 3,
  className = ''
}) => {
  const sizeClass = size !== 'md' ? ` ui-feedback-state--${size}` : '';

  // Carregando não é "vazio" nem "zero": o esqueleto é só desenho, e o
  // estado vai escrito para leitor de tela.
  if (loading) {
    return (
      <div
        className={`ui-feedback-state ui-feedback-state--loading${sizeClass} ${className}`.trim()}
        role="status"
        aria-busy="true"
      >
        <span className="sr-only">Carregando</span>
        <Skeleton lines={skeletonLines} />
      </div>
    );
  }

  const Icon = CustomIcon || (error ? AlertCircle : Inbox);

  return (
    <div className={`ui-feedback-state${error ? ' ui-feedback-state--error' : ''}${sizeClass} ${className}`.trim()}>
      <div className="ui-feedback-state__icon" aria-hidden="true">
        <Icon size={size === 'sm' ? 20 : size === 'lg' ? 36 : 28} />
      </div>
      {title && <p className="ui-feedback-state__title">{title}</p>}
      {description && <p className="ui-feedback-state__description">{description}</p>}
      {error && onRetry && (
        <div className="ui-feedback-state__action">
          <button type="button" className="ui-button ui-button-secondary ui-button-sm" onClick={onRetry}>
            <RefreshCw size={13} aria-hidden="true" /> Tentar novamente
          </button>
        </div>
      )}
      {!error && action && onAction && (
        <div className="ui-feedback-state__action">
          <button type="button" className="ui-button ui-button-primary ui-button-sm" onClick={onAction}>
            {action}
          </button>
        </div>
      )}
    </div>
  );
};

export default FeedbackState;
