export const Logger = {
  info: (action: string, details?: unknown) => {
    console.info(JSON.stringify({ level: 'INFO', action, details, timestamp: new Date().toISOString() }));
  },
  warn: (action: string, details?: unknown) => {
    console.warn(JSON.stringify({ level: 'WARN', action, details, timestamp: new Date().toISOString() }));
  },
  error: (action: string, details?: unknown) => {
    const errorDetails =
      details instanceof Error ? { message: details.message, stack: details.stack, name: details.name } : details;
    console.error(
      JSON.stringify({ level: 'ERROR', action, details: errorDetails, timestamp: new Date().toISOString() }),
    );
  },
};
