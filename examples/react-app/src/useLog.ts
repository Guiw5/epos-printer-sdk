import { useCallback, useState } from 'react';

export function useLog() {
  const [lines, setLines] = useState<string[]>([]);

  const log = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString();
    setLines((prev) => [...prev, `[${time}] ${message}`]);
  }, []);

  const clear = useCallback(() => setLines([]), []);

  return { lines, log, clear };
}
