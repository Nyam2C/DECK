import { readdir } from "fs/promises";
import { resolve, dirname, basename } from "path";
import { homedir } from "os";

/**
 * 부분 경로를 받아 매칭되는 디렉토리 후보 목록을 반환한다.
 *
 * 예시:
 *   "~/pro" → ["~/project-a", "~/project-b", "~/programming"]
 *   "/home/user/D" → ["/home/user/Desktop", "/home/user/Documents"]
 */
export async function autocomplete(partial: string): Promise<string[]> {
  // ~ 확장
  const expanded = partial.startsWith("~") ? partial.replace("~", homedir()) : partial;

  const endsWithSlash = partial.endsWith("/") || partial.endsWith("\\");
  const resolved = resolve(expanded);
  const parent = endsWithSlash ? resolved : dirname(resolved);
  const prefix = endsWithSlash ? "" : basename(resolved);

  try {
    const entries = await readdir(parent, { withFileTypes: true });
    const dirs = entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => entry.name.startsWith(prefix))
      .filter((entry) => !entry.name.startsWith("."))
      .map((entry) => {
        const fullPath = resolve(parent, entry.name);
        // ~ 축약 복원
        if (partial.startsWith("~")) {
          return fullPath.replace(homedir(), "~");
        }
        return fullPath;
      })
      .sort();

    return dirs;
  } catch {
    return [];
  }
}
