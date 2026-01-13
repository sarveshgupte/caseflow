const { markDegraded, resetState, setState, STATES } = require('./systemState.service');

const DEFAULT_OPTIONS = {
  failureThreshold: 3,
  cooldownMs: 30000,
};

const breakers = new Map();

const ensureBreaker = (name) => {
  if (!breakers.has(name)) {
    breakers.set(name, {
      name,
      state: 'CLOSED',
      failureCount: 0,
      lastFailureAt: null,
      openedAt: null,
      options: { ...DEFAULT_OPTIONS },
    });
  }
  return breakers.get(name);
};

const recordSuccess = (name) => {
  const breaker = ensureBreaker(name);
  breaker.failureCount = 0;
  if (breaker.state !== 'CLOSED') {
    breaker.state = 'CLOSED';
    breaker.openedAt = null;
    breaker.lastFailureAt = null;
    const anyOpen = Array.from(breakers.values()).some((b) => b.state === 'OPEN');
    if (!anyOpen) {
      setState(STATES.NORMAL);
    }
  }
};

const tripBreaker = (breaker) => {
  breaker.state = 'OPEN';
  breaker.openedAt = Date.now();
  markDegraded(`circuit:${breaker.name}`, { state: 'OPEN' });
};

const recordFailure = (name) => {
  const breaker = ensureBreaker(name);
  breaker.failureCount += 1;
  breaker.lastFailureAt = Date.now();
  if (breaker.failureCount >= breaker.options.failureThreshold && breaker.state !== 'OPEN') {
    tripBreaker(breaker);
  }
};

const allow = (name) => {
  const breaker = ensureBreaker(name);
  if (breaker.state === 'OPEN') {
    const elapsed = Date.now() - (breaker.openedAt || 0);
    if (elapsed >= breaker.options.cooldownMs) {
      breaker.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }
  return true;
};

const getSnapshot = () => Array.from(breakers.values()).map((breaker) => ({
  name: breaker.name,
  state: breaker.state,
  failureCount: breaker.failureCount,
  lastFailureAt: breaker.lastFailureAt,
  openedAt: breaker.openedAt,
  options: breaker.options,
}));

const isAnyOpen = () => Array.from(breakers.values()).some((b) => b.state === 'OPEN');

const configureBreaker = (name, options = {}) => {
  const breaker = ensureBreaker(name);
  breaker.options = { ...breaker.options, ...options };
  return breaker;
};

module.exports = {
  allow,
  recordFailure,
  recordSuccess,
  getSnapshot,
  isAnyOpen,
  configureBreaker,
};
