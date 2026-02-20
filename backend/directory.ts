import { readdir } from "fs/promises";
import { resolve, dirname, basename } from "path";
import { homedir } from "os";
import { isWindows, getWslHomedir, toWslPath, wslExec } from "./wsl";

/**
 * Windows에서 WSL의 find 명령으로 디렉토리 목록을 조회한다.
 */
async function autocompleteViaWsl(partial: string): Promise<string[]> {
  const home = getWslHomedir();
  const expanded = partial.startsWith("~") ? partial.replace("~", home) : partial;

  const endsWithSlash = partial.endsWith("/") || partial.endsWith("\\");
  // POSIX 경로 처리: dirname/basename을 수동으로
  const normalized = toWslPath(expanded);
  const lastSlash = normalized.lastIndexOf("/");
  const parent = endsWithSlash ? normalized : normalized.substring(0, lastSlash) || "/";
  const prefix = endsWithSlash ? "" : normalized.substring(lastSlash + 1);

  try {
    const escaped = parent.replace(/'/g, "'\\''");
    const prefixEscaped = prefix.replace(/'/g, "'\\''");
    const script = `find '${escaped}' -maxdepth 1 -mindepth 1 -type d -name '${prefixEscaped}*' ! -name '.*' -printf '%f\\n' 2>/dev/null | sort`;
    const output = await wslExec(script);
    if (!output) return [];

    return output
      .split("\n")
      .filter(Boolean)
      .map((name) => {
        const fullPath = parent === "/" ? `/${name}` : `${parent}/${name}`;
        if (partial.startsWith("~")) {
          return fullPath.replace(home, "~");
        }
        return fullPath;
      });
  } catch {
    return [];
  }
}

/**
 * 부분 경로를 받아 매칭되는 디렉토리 후보 목록을 반환한다.
 *
 * 예시:
 *   "~/pro" → ["~/project-a", "~/project-b", "~/programming"]
 *   "/home/user/D" → ["/home/user/Desktop", "/home/user/Documents"]
 */
export async function autocomplete(partial: string): Promise<string[]> {
  if (isWindows) return autocompleteViaWsl(partial);

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
