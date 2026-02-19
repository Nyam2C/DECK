import { usePanelStore } from "../stores/panel-store";
import { Panel } from "./Panel";

/**
 * 패널 수에 따른 Grid 클래스 규칙:
 * 1개: grid-cols-1 grid-rows-1
 * 2개: grid-cols-2 grid-rows-1
 * 3개: grid-cols-2 grid-rows-2 (왼쪽 2개 + 오른쪽 1개)
 * 4개: grid-cols-2 grid-rows-2
 *
 * 핀 상태일 때 (Google Meet 스타일):
 * 핀된 패널이 왼쪽 70%, 나머지가 오른쪽 30%에 세로 나열
 * 2개: grid-cols-[7fr_3fr] grid-rows-1
 * 3개: grid-cols-[7fr_3fr] grid-rows-2
 * 4개: grid-cols-[7fr_3fr] grid-rows-3
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
 * 개별 패널의 grid 배치 클래스를 반환한다.
 * 모든 경우에 명시적 배치를 사용하여 DOM 순서와 무관하게 시각 위치를 결정한다.
 * (DOM 순서가 바뀌면 xterm WebGL 컨텍스트가 유실되므로 DOM은 고정해야 함)
 */
export function getPanelSpanClassName(
  index: number,
  panelCount: number,
  hasPinned: boolean,
  isPinned: boolean,
): string {
  // 핀 모드: 핀 패널은 왼쪽 전체 높이, 나머지는 오른쪽 각 행
  // Tailwind JIT는 동적 클래스를 감지 못하므로 전체 문자열 사용
  if (hasPinned) {
    if (isPinned) {
      const pinnedClasses: Record<number, string> = {
        2: "col-start-1 row-start-1",
        3: "col-start-1 row-start-1 row-span-2",
        4: "col-start-1 row-start-1 row-span-3",
      };
      return pinnedClasses[panelCount] ?? "col-start-1 row-start-1";
    }
    const rowClasses = [
      "",
      "col-start-2 row-start-1",
      "col-start-2 row-start-2",
      "col-start-2 row-start-3",
    ];
    return rowClasses[index] ?? "";
  }

  // 일반 모드: 모든 경우 명시적 배치
  if (panelCount === 1) {
    return "col-start-1 row-start-1";
  }
  if (panelCount === 2) {
    const classes = ["col-start-1 row-start-1", "col-start-2 row-start-1"];
    return classes[index] ?? "";
  }
  if (panelCount === 3) {
    const classes = [
      "col-start-1 row-start-1",
      "col-start-1 row-start-2",
      "col-start-2 row-start-1 row-span-2",
    ];
    return classes[index] ?? "";
  }
  if (panelCount === 4) {
    const classes = [
      "col-start-1 row-start-1",
      "col-start-2 row-start-1",
      "col-start-1 row-start-2",
      "col-start-2 row-start-2",
    ];
    return classes[index] ?? "";
  }
  return "";
}

export function Grid() {
  const panels = usePanelStore((s) => s.panels);
  const pinnedId = usePanelStore((s) => s.pinnedId);
  const hasPinned = pinnedId !== null;

  // 시각적 순서 계산 (핀 패널 우선)
  const visualOrder = hasPinned
    ? [...panels.filter((p) => p.id === pinnedId), ...panels.filter((p) => p.id !== pinnedId)]
    : panels;
  const visualIndexMap = new Map(visualOrder.map((p, i) => [p.id, i]));

  // DOM 순서는 ID로 정렬하여 항상 고정 — xterm WebGL 컨텍스트 유실 방지
  const stableOrder = [...panels].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <main className={getGridClassName(panels.length, hasPinned)}>
      {stableOrder.map((panel) => {
        const visualIndex = visualIndexMap.get(panel.id) ?? 0;
        return (
          <Panel
            key={panel.id}
            panel={panel}
            spanClassName={getPanelSpanClassName(
              visualIndex,
              panels.length,
              hasPinned,
              panel.id === pinnedId,
            )}
          />
        );
      })}
    </main>
  );
}
