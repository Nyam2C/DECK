import { Toolbar } from "./components/Toolbar";
import { Grid } from "./components/Grid";
import { Settings } from "./components/Settings";
import { useSettingsStore } from "./stores/settings-store";

export function App() {
  const isSettingsOpen = useSettingsStore((s) => s.isOpen);

  return (
    <div className="bg-deck-bg dot-grid-bg text-deck-text font-dot h-screen flex flex-col overflow-hidden select-none">
      <Toolbar />

      {/* 스캔라인 구분선 */}
      <div className="text-center text-deck-border text-[10px] leading-none py-0.5 tracking-[0.5em] overflow-hidden whitespace-nowrap shrink-0">
        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
      </div>

      <Grid />

      {isSettingsOpen && <Settings />}
    </div>
  );
}
