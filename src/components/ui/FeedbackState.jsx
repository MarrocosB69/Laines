import React from 'react';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import Skeleton from './Skeleton';

const FeedbackState = ({
  loading = false,
  empty = false,
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

  if (loading) {
    return (
      <div className={`ui-feedback-state ui-feedback-state--loading${sizeClass} ${className}`.trim()}>
        <Skeleton lines={skeletonLines} />
      </div>
    );
  }

  const Icon = CustomIcon || (error ? AlertCircle : Inbox);

  return (
    <div className={`ui-feedback-state${error ? ' ui-feedback-state--error' : ''}${sizeClass} ${className}`.trim()}>
      <div className="ui-feedback-state__icon">
        <Icon size={size === 'sm' ? 20 : size === 'lg' ? 36 : 28} />
      </div>
      {title && <p className="ui-feedback-state__title">{title}</p>}
      {description && <p className="ui-feedback-state__description">{description}</p>}
      {error && onRetry && (
        <div className="ui-feedback-state__action">
          <button type="button" className="ui-button ui-button-secondary ui-button-sm" onClick={onRetry}>
            <RefreshCw size={13} /> Tentar novamente
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
