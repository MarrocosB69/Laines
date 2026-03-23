import api from './api';

export const logAudit = async ({ user, action, entity, entityId, meta = {} }) => {
  try {
    await api.post('/auditoria', {
      action,
      entity,
      entityId: entityId || null,
      meta: {
        ...meta,
        triggeredBy: user?.id || user?.uid || null
      }
    });
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error);
  }
};
