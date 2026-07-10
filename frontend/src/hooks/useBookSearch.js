import { useEffect, useState } from 'react';
import api from '../services/api';

export default function useBookSearch(query, delay = 400) {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 3) {
      setResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get(`/books/search?q=${encodeURIComponent(query)}`);
        setResults(data.books || []);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay]);

  return { results, isLoading };
}
