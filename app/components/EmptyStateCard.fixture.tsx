import { InboxIcon, LightBulbIcon, CubeIcon } from "@heroicons/react/24/outline";
import EmptyStateCard from "./EmptyStateCard";

export default {
  "Inline — text only": () => (
    <div style={{ width: 280, background: "#12151A", padding: 16 }}>
      <EmptyStateCard text="By-products appear here once you add recipes" />
    </div>
  ),

  "Inline — with icon": () => (
    <div style={{ width: 280, background: "#12151A", padding: 16 }}>
      <EmptyStateCard
        icon={<LightBulbIcon />}
        text="What do you want to produce? Click + to set a target"
      />
    </div>
  ),

  "Inline — with action": () => (
    <div style={{ width: 280, background: "#12151A", padding: 16 }}>
      <EmptyStateCard
        icon={<InboxIcon />}
        text="Required inputs will show here after adding recipes"
        action={{ label: "Add Recipe", onClick: () => alert("clicked") }}
      />
    </div>
  ),

  "Centered (canvas)": () => (
    <div style={{ width: 800, height: 500, background: "#12151A", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <EmptyStateCard
        variant="centered"
        icon={<CubeIcon />}
        text="Add a production goal from the sidebar to start building"
      />
    </div>
  ),
};
