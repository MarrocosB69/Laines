import React from 'react';
import './ui.css';

const Button = ({ className = '', variant = 'primary', type = 'button', ...props }) => (
  <button type={type} className={`ui-button ui-button-${variant} ${className}`.trim()} {...props} />
);

export default Button;
