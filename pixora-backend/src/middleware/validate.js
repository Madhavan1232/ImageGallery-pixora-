/**
 * Input validation middleware
 * Validates query and body parameters
 */

const { ValidationError } = require('../utils/errorHandler');

/**
 * Validate query parameters
 * @param {object} schema - Validation schema
 * @example
 * validateQuery({
 *   page: { type: 'number', min: 1, max: 999 },
 *   per_page: { type: 'number', min: 1, max: 100 },
 * })
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.query[field];

      if (rules.required && value === undefined) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value !== undefined) {
        if (rules.type === 'number') {
          const num = parseInt(value, 10);
          if (isNaN(num)) {
            errors.push(`${field} must be a number`);
          } else {
            if (rules.min !== undefined && num < rules.min) {
              errors.push(`${field} must be >= ${rules.min}`);
            }
            if (rules.max !== undefined && num > rules.max) {
              errors.push(`${field} must be <= ${rules.max}`);
            }
            req.query[field] = num;
          }
        } else if (rules.type === 'string') {
          if (typeof value !== 'string') {
            errors.push(`${field} must be a string`);
          } else {
            if (rules.maxLength && value.length > rules.maxLength) {
              errors.push(`${field} must be <= ${rules.maxLength} characters`);
            }
            if (rules.pattern && !rules.pattern.test(value)) {
              errors.push(`${field} has invalid format`);
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError(errors.join(', ')));
    }

    next();
  };
};

/**
 * Validate body parameters
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const errors = [];
    const data = req.body || {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];

      if (rules.required && value === undefined) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value !== undefined) {
        if (rules.type === 'string' && typeof value !== 'string') {
          errors.push(`${field} must be a string`);
        } else if (rules.type === 'number' && typeof value !== 'number') {
          errors.push(`${field} must be a number`);
        } else if (rules.type === 'array' && !Array.isArray(value)) {
          errors.push(`${field} must be an array`);
        }
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError(errors.join(', ')));
    }

    next();
  };
};

module.exports = { validateQuery, validateBody };
