
import { useMemo } from "react";
import { type RouteConfig, route, index } from "@react-router/dev/routes";
import { useParams } from "react-router";

const routes = [
   index("routes/index.tsx"),
   route("zones/:zone/:factory?", "routes/home.tsx", [
      route("settings/:tab?", "components/Settings/FactorySettings.tsx"),
   ])
] satisfies RouteConfig;

export function useStableParam(key: string, defaultValue?: string): string {
   const params = useParams();
   
   return useMemo(() => {      
      const val = params[key]
      if (val === undefined) {
         if (defaultValue === undefined) throw new Error(`No param ${key} in route, and no default value provided`);
         return defaultValue;
      }
      return val;
   }, [params[key]]);
}

export default routes;
