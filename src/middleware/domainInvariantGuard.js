const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const isInvalidTransition = (fromStatus, toStatus) => {
  if (!fromStatus || !toStatus) return false;
  const normalizedFrom = String(fromStatus).toUpperCase();
  const normalizedTo = String(toStatus).toUpperCase();

  if (normalizedFrom === 'CLOSED' && normalizedTo === 'IN_PROGRESS') {
    return true;
  }
  if (['CLOSED', 'FILED', 'ARCHIVED'].includes(normalizedFrom) && !['CLOSED', 'FILED', 'ARCHIVED'].includes(normalizedTo)) {
    return true;
  }
  return false;
};

const domainInvariantGuard = (req, res, next) => {
  if (!mutatingMethods.has(req.method)) {
    return next();
  }

  if (req.firmId && req.body?.firmId && req.body.firmId !== req.firmId) {
    return res.status(403).json({ error: 'cross_firm_access_denied' });
  }
  if (req.firmId && req.params?.firmId && req.params.firmId !== req.firmId) {
    return res.status(403).json({ error: 'cross_firm_access_denied' });
  }

  if (req.user && req.body?.role && req.params?.userId) {
    const userIdentifier = String(req.user._id || req.user.id || req.user.xID || '');
    if (userIdentifier && String(req.params.userId) === userIdentifier) {
      return res.status(403).json({ error: 'immutable_role_self_change' });
    }
  }

  const previousStatus = req.body?.previousStatus || req.body?.currentStatus;
  const nextStatus = req.body?.status || req.body?.nextStatus;
  if (isInvalidTransition(previousStatus, nextStatus)) {
    return res.status(400).json({ error: 'invalid_state_transition' });
  }

  const targetClient = req.client || req.targetClient;
  if (targetClient?.isDefaultClient && req.method === 'DELETE') {
    return res.status(400).json({ error: 'default_client_cannot_be_deleted' });
  }
  if (targetClient?.isSystemClient && mutatingMethods.has(req.method)) {
    return res.status(403).json({ error: 'system_client_immutable' });
  }

  return next();
};

module.exports = domainInvariantGuard;
