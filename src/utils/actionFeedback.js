export const notifyActionBlocked = (
  notify,
  {
    title = 'Ação bloqueada',
    actionLabel = 'Operação',
    reason = 'Sem permissão para executar esta ação.'
  } = {}
) => {
  if (typeof notify !== 'function') return false;
  notify({
    type: 'warning',
    title,
    message: `${actionLabel}: ${reason}`
  });
  return false;
};

export const guardAction = (notify, condition, options = {}) => {
  if (condition) return true;
  return notifyActionBlocked(notify, options);
};
