const { VALID_CATEGORIES, VALID_STATUSES } = require('./constants');

function normalizeText(input) {
  if (typeof input !== 'string') return '';
  return input.trim();
}

function asNonNegativeNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return `${fieldName} must be a number greater than or equal to 0.`;
  }
  return null;
}

function validateItemPayload(payload, { partial = false } = {}) {
  const errors = [];

  if (!partial || Object.hasOwn(payload, 'name')) {
    const name = normalizeText(payload.name);
    if (!name) {
      errors.push('name is required.');
    } else if (name.length > 100) {
      errors.push('name must be 100 characters or fewer.');
    }
  }

  if (!partial || Object.hasOwn(payload, 'category')) {
    if (!VALID_CATEGORIES.includes(payload.category)) {
      errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}.`);
    }
  }

  if (!partial || Object.hasOwn(payload, 'quantity')) {
    const err = asNonNegativeNumber(payload.quantity, 'quantity');
    if (err) errors.push(err);
  }

  if (!partial || Object.hasOwn(payload, 'unit')) {
    const unit = normalizeText(payload.unit || 'bottle');
    if (!unit) {
      errors.push('unit is required.');
    } else if (unit.length > 30) {
      errors.push('unit must be 30 characters or fewer.');
    }
  }

  if (!partial || Object.hasOwn(payload, 'status')) {
    if (!VALID_STATUSES.includes(payload.status)) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}.`);
    }
  }

  if (!partial || Object.hasOwn(payload, 'par_level')) {
    const err = asNonNegativeNumber(payload.par_level, 'par_level');
    if (err) errors.push(err);
  }

  if (Object.hasOwn(payload, 'notes') && typeof payload.notes !== 'string') {
    errors.push('notes must be text.');
  }

  return errors;
}

module.exports = {
  normalizeText,
  validateItemPayload,
  asNonNegativeNumber
};
