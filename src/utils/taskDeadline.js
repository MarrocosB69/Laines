const TASK_TIME_ZONE = 'America/Sao_Paulo';
const MS_PER_DAY = 86_400_000;
const saoPauloParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TASK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
const deliveryFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TASK_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const parseCivilDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utc = Date.UTC(year, month - 1, day);
  if (new Date(utc).toISOString().slice(0, 10) !== value) return null;
  return { dayNumber: utc / MS_PER_DAY, label: `${dayText}/${monthText}/${yearText}` };
};

const saoPauloDayNumber = (date) => {
  const parts = Object.fromEntries(saoPauloParts.formatToParts(date).map((part) => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / MS_PER_DAY;
};

export const getTaskDeadlineInfo = (task, now = new Date()) => {
  if (task?.status === 'concluida') {
    const completedAt = task.completedAt ? new Date(task.completedAt) : null;
    return {
      tone: 'done',
      label: completedAt && !Number.isNaN(completedAt.getTime())
        ? `Entregue em ${deliveryFormatter.format(completedAt)}`
        : 'Concluída',
      dateLabel: ''
    };
  }

  const due = parseCivilDate(task?.dueDate);
  if (!due) return { tone: 'neutral', label: task?.dueDate ? 'Prazo indisponível' : 'Sem prazo', dateLabel: '' };
  const days = due.dayNumber - saoPauloDayNumber(now);
  return {
    tone: days < 0 ? 'overdue' : days === 0 ? 'today' : 'upcoming',
    label: days < 0 ? `Atrasada há ${-days} ${-days === 1 ? 'dia' : 'dias'}`
      : days === 0 ? 'Vence hoje' : `Faltam ${days} ${days === 1 ? 'dia' : 'dias'}`,
    dateLabel: `Prazo ${due.label}`
  };
};
