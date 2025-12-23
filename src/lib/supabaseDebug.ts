export type SupabaseLog = {
  timestamp: string;
  operation: string;
  table?: string;
  payload?: any;
  response?: any;
  error?: any;
};

const STORAGE_KEY = 'supabase_debug_logs';

export function saveSupabaseLog(log: SupabaseLog) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    existing.push(log);
    // keep last 200 entries
    const sliced = existing.slice(-200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sliced));
  } catch (e) {
    // ignore
  }
  // also output to console for immediate visibility
  if (log.error) {
    console.error('[SupabaseLog]', log.operation, log.table, log.error, log.response);
  } else {
    console.log('[SupabaseLog]', log.operation, log.table, log.response);
  }
}

export function createSupabaseLog(operation: string, table?: string, payload?: any, response?: any, error?: any) {
  const log = {
    timestamp: new Date().toISOString(),
    operation,
    table,
    payload,
    response,
    error: error ? (error.message || error) : null,
  } as SupabaseLog;
  saveSupabaseLog(log);
  return log;
}

export function getSupabaseLogs(): SupabaseLog[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function clearSupabaseLogs() {
  localStorage.removeItem(STORAGE_KEY);
}
