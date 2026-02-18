import { describe, it, expect, beforeEach } from "vitest";
import { usePanelStore } from "../../stores/panel-store";

describe("usePanelStore", () => {
  beforeEach(() => {
    // 매 테스트마다 스토어 초기화
    usePanelStore.setState({ panels: [], focusedId: null, pinnedId: null });
  });

  it("addPanel로 패널을 추가한다", () => {
    const id = usePanelStore.getState().addPanel();
    expect(id).toBeTruthy();
    expect(usePanelStore.getState().panels).toHaveLength(1);
    expect(usePanelStore.getState().focusedId).toBe(id);
  });

  it("최대 4개까지만 추가된다", () => {
    for (let i = 0; i < 4; i++) {
      usePanelStore.getState().addPanel();
    }
    const id = usePanelStore.getState().addPanel();
    expect(id).toBeNull();
    expect(usePanelStore.getState().panels).toHaveLength(4);
  });

  it("exited 패널은 최대 개수에서 제외된다", () => {
    for (let i = 0; i < 4; i++) {
      usePanelStore.getState().addPanel();
    }
    // 하나를 exited로 변경
    const exitedId = usePanelStore.getState().panels[0].id;
    usePanelStore.getState().updatePanel(exitedId, { status: "exited" });
    // exited 패널이 있으므로 새 패널 추가 가능
    const newId = usePanelStore.getState().addPanel();
    expect(newId).toBeTruthy();
    expect(usePanelStore.getState().panels).toHaveLength(5);
  });

  it("removePanel로 패널을 제거한다", () => {
    const id = usePanelStore.getState().addPanel()!;
    usePanelStore.getState().removePanel(id);
    expect(usePanelStore.getState().panels).toHaveLength(0);
  });

  it("포커스된 패널 제거 시 마지막 패널로 포커스 이동", () => {
    const id1 = usePanelStore.getState().addPanel()!;
    const id2 = usePanelStore.getState().addPanel()!;
    usePanelStore.getState().setFocus(id2);
    usePanelStore.getState().removePanel(id2);
    expect(usePanelStore.getState().focusedId).toBe(id1);
  });

  it("setFocus로 포커스를 변경한다", () => {
    const id1 = usePanelStore.getState().addPanel()!;
    usePanelStore.getState().addPanel();
    usePanelStore.getState().setFocus(id1);
    expect(usePanelStore.getState().focusedId).toBe(id1);
  });

  it("updatePanel로 패널 상태를 업데이트한다", () => {
    const id = usePanelStore.getState().addPanel()!;
    usePanelStore.getState().updatePanel(id, { name: "test-project", status: "active" });
    const panel = usePanelStore.getState().panels.find((p) => p.id === id);
    expect(panel?.name).toBe("test-project");
    expect(panel?.status).toBe("active");
  });

  it("reorderPanels로 순서를 변경한다", () => {
    const id1 = usePanelStore.getState().addPanel()!;
    const id2 = usePanelStore.getState().addPanel()!;
    const id3 = usePanelStore.getState().addPanel()!;
    usePanelStore.getState().reorderPanels(0, 2);
    const ids = usePanelStore.getState().panels.map((p) => p.id);
    expect(ids).toEqual([id2, id3, id1]);
  });
});
