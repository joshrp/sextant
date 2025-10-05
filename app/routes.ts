
import { useMemo } from "react";
import { type RouteConfig, route } from "@react-router/dev/routes";
import { useParams } from "react-router";

export default [route("/factories/:selectedFactory", "routes/home.tsx", [
   route("settings/:tabId?", "components/Settings/FactorySettings.tsx"),
])] satisfies RouteConfig;

export function useStableParam(key: string) {
   const params = useParams();
   return useMemo(() => params[key], [params[key]]);
}
