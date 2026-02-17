import type { ClientMessage, ServerMessage } from "./types";
import type { PtyManager } from "./pty-manager";
import { autocomplete } from "./directory";

type SendFn = (msg: ServerMessage) => void;

/**
 * WebSocket으로 수신한 JSON 문자열을 파싱하고,
 * 메시지 타입에 따라 적절한 PTY 매니저 메서드를 호출한다.
 */
export function handleMessage(raw: string, ptyManager: PtyManager, send: SendFn): void {
  let msg: ClientMessage;

  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    send({ type: "error", panelId: "", message: "잘못된 JSON 메시지" });
    return;
  }

  switch (msg.type) {
    case "create": {
      try {
        // options 문자열을 공백으로 분리하여 args 배열 구성
        // 예: "--model sonnet --permission-mode plan" → ["--model", "sonnet", ...]
        const args = msg.options ? msg.options.split(/\s+/).filter(Boolean) : [];
        const panelId = ptyManager.create(msg.cli, args, msg.path, 80, 24);
        send({ type: "created", panelId });
      } catch (e) {
        send({
          type: "error",
          panelId: "",
          message: e instanceof Error ? e.message : "패널 생성 실패",
        });
      }
      break;
    }

    case "input": {
      try {
        ptyManager.write(msg.panelId, msg.data);
      } catch (e) {
        send({
          type: "error",
          panelId: msg.panelId,
          message: e instanceof Error ? e.message : "입력 전달 실패",
        });
      }
      break;
    }

    case "resize": {
      try {
        ptyManager.resize(msg.panelId, msg.cols, msg.rows);
      } catch (e) {
        send({
          type: "error",
          panelId: msg.panelId,
          message: e instanceof Error ? e.message : "리사이즈 실패",
        });
      }
      break;
    }

    case "kill": {
      ptyManager.kill(msg.panelId);
      break;
    }

    case "autocomplete": {
      autocomplete(msg.partial).then((candidates) => {
        send({ type: "autocomplete-result", candidates });
      });
      break;
    }

    default: {
      send({ type: "error", panelId: "", message: "알 수 없는 메시지 타입" });
    }
  }
}
