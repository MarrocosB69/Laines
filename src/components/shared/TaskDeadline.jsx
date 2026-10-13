import React from 'react';
import { getTaskDeadlineInfo } from '../../utils/taskDeadline';
import './TaskDeadline.css';

const TaskDeadline = ({ task, now, className = '' }) => {
  const { tone, label, dateLabel } = getTaskDeadlineInfo(task, now);
  return (
    <div className={`task-deadline task-deadline-${tone} ${className}`.trim()}>
      {dateLabel && <span>{dateLabel}</span>}
      <strong>{label}</strong>
    </div>
  );
};

export default TaskDeadline;
