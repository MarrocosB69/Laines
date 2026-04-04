import React from 'react';
import { Loader2 } from 'lucide-react';
import './ui.css';

const Button = ({
  className = '',
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled = false,
  fullWidth = false,
  children,
  ...props
}) => (
  <button
    type={type}
    className={[
      'ui-button',
      `ui-button-${variant}`,
      `ui-button-${size}`,
      fullWidth ? 'ui-button-full' : '',
      className
    ].filter(Boolean).join(' ')}
    disabled={disabled || loading}
    aria-busy={loading}
    {...props}
  >
    {loading ? <Loader2 size={16} className="ui-button-spinner" aria-hidden="true" /> : null}
    {children}
  </button>
);

export default Button;
