const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

const requestStorage = new AsyncLocalStorage();
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

const createRequestId = (candidate) => {
  const normalized = String(candidate || '').trim();
  return REQUEST_ID_PATTERN.test(normalized) ? normalized : crypto.randomUUID();
};

const runWithRequestContext = (context, callback) => requestStorage.run({ ...context }, callback);

const getRequestContext = () => requestStorage.getStore() || {};

const updateRequestContext = (patch = {}) => {
  const current = requestStorage.getStore();
  if (!current) return;
  Object.assign(current, patch);
};

module.exports = {
  createRequestId,
  getRequestContext,
  runWithRequestContext,
  updateRequestContext,
};
