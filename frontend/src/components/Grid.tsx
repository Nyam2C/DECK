import { usePanelStore } from "../stores/panel-store";
import { Panel } from "./Panel";

/**
 * 패널 수에 따른 Grid 클래스 규칙:
 * 1개: grid-cols-1 grid-rows-1
 * 2개: grid-cols-2 grid-rows-1
 * 3개: grid-cols-2 grid-rows-2 (마지막 패널 col-span-2)
 * 4개: grid-cols-2 grid-rows-2
 *
 * 핀 상태일 때:
 * 2개: grid-cols-[7fr_3fr] grid-rows-1
 * 3개: grid-cols-[7fr_3fr] grid-rows-2 (좌측 패널 row-span-2)
 * 4개: grid-cols-[7fr_3fr] grid-rows-3 (좌측 패널 row-span-3)
 */
export function getGridClassName(panelCount: number, hasPinned: boolean): string {
  const base = "flex-1 grid gap-3 p-3 min-h-0 min-w-[800px]";

  if (hasPinned) {
    switch (panelCount) {
      case 2:
        return `${base} grid-cols-[7fr_3fr] grid-rows-1`;
      case 3:
        return `${base} grid-cols-[7fr_3fr] grid-rows-2`;
      case 4:
        return `${base} grid-cols-[7fr_3fr] grid-rows-3`;
      default:
        return `${base} grid-cols-1 grid-rows-1`;
    }
  }

  switch (panelCount) {
    case 1:
      return `${base} grid-cols-1 grid-rows-1`;
    case 2:
      return `${base} grid-cols-2 grid-rows-1`;
    case 3:
      return `${base} grid-cols-2 grid-rows-2`;
    case 4:
      return `${base} grid-cols-2 grid-rows-2`;
    default:
      return `${base} grid-cols-1 grid-rows-1`;
  }
}

/**
 * 3개 패널에서 마지막 패널의 col-span-2 클래스를 반환한다.
 * 핀 상태에서는 적용하지 않는다.
 */
export function getPanelSpanClassName(
  index: number,
  panelCount: number,
  hasPinned: boolean,
  isPinned: boolean,
): string {
  // 핀된 패널: row-span 적용
  if (hasPinned && isPinned) {
    const otherCount = panelCount - 1;
    if (otherCount >= 1) return `row-span-${otherCount}`;
  }

  // 일반 모드: 3개일 때 마지막 패널 col-span-2
  if (!hasPinned && panelCount === 3 && index === 2) {
    return "col-span-2";
  }

  return "";
}

export function Grid() {
  const panels = usePanelStore((s) => s.panels);
  const pinnedId = usePanelStore((s) => s.pinnedId);
  const hasPinned = pinnedId !== null;

  // 핀된 패널을 먼저 배치
  const sortedPanels = hasPinned
    ? [...panels.filter((p) => p.id === pinnedId), ...panels.filter((p) => p.id !== pinnedId)]
    : panels;

  return (
    <main className={getGridClassName(panels.length, hasPinned)}>
      {sortedPanels.map((panel, index) => (
        <Panel
          key={panel.id}
          panel={panel}
          spanClassName={getPanelSpanClassName(
            index,
            panels.length,
            hasPinned,
            panel.id === pinnedId,
          )}
        />
      ))}
    </main>
  );
}
