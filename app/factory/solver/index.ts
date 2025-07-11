import { useEffect, useRef, useState } from 'react';

import Highs, { type Highs as HighsType } from "highs";

export default class Solver {
  constructor(highs: HighsType) {
    // Initialize the solver here if needed
    console.log("Solver initialized with Highs", highs);
  } 
}

const defaultUrl = "https://lovasoa.github.io/highs-js/";
export const useHighs = () => {

  const url = useRef('');
  const [highs, setHighs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async (url:string) => {
    console.log("Loading Highs from", url);
    return await Highs({locateFile: (file: string) => url + file});
  }

  useEffect(() => {
    console.log("useHighs effect", url.current, defaultUrl);
    if (url.current !== defaultUrl) {
      setLoading(true);
      url.current = defaultUrl;
      load(defaultUrl)
        .then(exports => setHighs(exports))
        .finally(() => setLoading(false))
    }
  }, [defaultUrl]);
  return { highs, loading };
}
