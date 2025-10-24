import { useState, useEffect } from 'react';

export function useStdoutDimensions(): [number, number] {
  const [size, setSize] = useState<[number, number]>([
    process.stdout.rows || 24,
    process.stdout.columns || 80,
  ]);

  useEffect(() => {
    const update = () =>
      setSize([process.stdout.rows || 24, process.stdout.columns || 80]);
    process.stdout.on('resize', update);
    return () => {
      process.stdout.off('resize', update);
    };
  }, []);

  return size;
}
