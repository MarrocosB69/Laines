import React from 'react';

const ToggleSetting = ({ title, description, checked, onChange, disabled = false }) => (
  <div className="toggle-setting">
    <div className="toggle-info">
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
    <label className="toggle-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-slider" />
    </label>
  </div>
);

export default ToggleSetting;
