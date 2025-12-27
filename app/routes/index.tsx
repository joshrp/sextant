import { useEffect } from "react";
import { useNavigate } from "react-router";
import { usePlannerStore } from "~/context/PlannerContext";

export default function Index() {
  const navigate = useNavigate();
  const zones = usePlannerStore(state => state.zones);
  const lastZone = usePlannerStore(state => state.lastZone);

  useEffect(() => {
    // PlannerProvider creates a default "main" zone on initialization,
    // but we check defensively in case the store hasn't hydrated yet
    if (zones.length > 0) {
      // Navigate to the last used zone if available, otherwise the first zone
      let targetZoneId = zones[0].id;
      
      if (lastZone && zones.some(z => z.id === lastZone)) {
        targetZoneId = lastZone;
      }
      
      // The Zone component will handle factory defaulting
      navigate(`/zones/${targetZoneId}`, { replace: true });
    }
  }, [navigate, zones, lastZone]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <h1 className="text-2xl mb-4">Loading...</h1>
        <p className="text-gray-400">Redirecting to your factory planner...</p>
      </div>
    </div>
  );
}
