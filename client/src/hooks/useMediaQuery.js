import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    mql.addEventListener('change', onChange);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
