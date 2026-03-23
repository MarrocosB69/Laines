import React from 'react';
import './ui.css';

const Card = ({ className = '', children }) => (
  <div className={`ui-card ${className}`.trim()}>
    {children}
  </div>
);

export default Card;
