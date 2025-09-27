const truthyValues = new Set(['1', 'true', 'yes', 'y', 'on']);
const falsyValues = new Set(['0', 'false', 'no', 'n', 'off']);

function parseBoolean (value, defaultValue = false) {
  if (value == null) return defaultValue;
  const normalized = `${value}`.trim().toLowerCase();
  if (truthyValues.has(normalized)) return true;
  if (falsyValues.has(normalized)) return false;
  return defaultValue;
}

export function useDevelopmentServices () {
  if (process.env.FORCE_DEV_MODE != null) {
    return parseBoolean(process.env.FORCE_DEV_MODE, false);
  }
  if (process.env.USE_DEV_SERVICES != null) {
    return parseBoolean(process.env.USE_DEV_SERVICES, false);
  }
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  return false;
}

export function useAwsServices () {
  return !useDevelopmentServices();
}

export default { useDevelopmentServices, useAwsServices };
