/**
 * 드래그 앤 드롭 위치 교환 순수 함수.
 * draggedId와 dropTargetId의 위치를 서로 바꾼다.
 */
export function reorderPanelIds(
  panelIds: string[],
  draggedId: string,
  dropTargetId: string,
): string[] {
  if (draggedId === dropTargetId) return panelIds;

  const fromIndex = panelIds.indexOf(draggedId);
  const toIndex = panelIds.indexOf(dropTargetId);
  if (fromIndex === -1 || toIndex === -1) return panelIds;

  const result = [...panelIds];
  result[fromIndex] = dropTargetId;
  result[toIndex] = draggedId;
  return result;
}
