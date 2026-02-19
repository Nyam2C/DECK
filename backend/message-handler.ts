import type { ClientMessage, ServerMessage } from "./types";
import type { PtyManager } from "./pty-manager";
import { autocomplete } from "./directory";
import { checkHook, registerHook } from "./hook";
import { saveSession, hasClaudeConversations } from "./session-manager";

type SendFn = (msg: ServerMessage) => void;

/**
 * WebSocket으로 수신한 JSON 문자열을 파싱하고,
 * 메시지 타입에 따라 적절한 PTY 매니저 메서드를 호출한다.
 */
export async function handleMessage(
  raw: string,
  ptyManager: PtyManager,
  send: SendFn,
  port: number,
): Promise<void> {
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
        let { options } = msg;

        // Claude CLI + -r: 대화 기록이 없으면 -r 제거
        if (msg.cli === "claude" && /(?:^|\s)(?:-r|--resume)(?:\s|$)/.test(options)) {
          const hasConv = await hasClaudeConversations(msg.path);
          if (!hasConv) {
            options = options.replace(/(?:^|\s)(?:-r|--resume)(?=\s|$)/g, "").trim();
          }
        }

        // options 문자열을 공백으로 분리하여 args 배열 구성
        // 예: "--model sonnet --permission-mode plan" → ["--model", "sonnet", ...]
        const args = options ? options.split(/\s+/).filter(Boolean) : [];
        const panelId = ptyManager.create(
          msg.cli,
          args,
          msg.path,
          80,
          24,
          msg.panelId,
          msg.cli,
          options,
        );
        send({ type: "created", panelId });
        saveSession(ptyManager.getActivePanels());

        // Claude CLI일 때 훅 등록 상태 확인
        if (msg.cli === "claude") {
          checkHook(port).then((connected) => {
            send({ type: "hook-status", panelId, connected });
          });
        }
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
      saveSession(ptyManager.getActivePanels());
      break;
    }

    case "attach": {
      if (!ptyManager.has(msg.panelId)) {
        send({ type: "error", panelId: msg.panelId, message: "세션 없음" });
        break;
      }
      try {
        ptyManager.resize(msg.panelId, msg.cols, msg.rows);
      } catch {
        // 리사이즈 실패는 무시 — 세션은 여전히 유효
      }
      const scrollback = ptyManager.getScrollback(msg.panelId);
      if (scrollback) {
        send({ type: "output", panelId: msg.panelId, data: scrollback });
      }
      break;
    }

    case "autocomplete": {
      autocomplete(msg.partial).then((candidates) => {
        send({ type: "autocomplete-result", panelId: msg.panelId, candidates });
      });
      break;
    }

    case "register-hook": {
      registerHook(port)
        .then(() => {
          send({ type: "hook-status", panelId: msg.panelId, connected: true });
        })
        .catch((e) => {
          send({
            type: "error",
            panelId: msg.panelId,
            message: e instanceof Error ? e.message : "훅 등록 실패",
          });
        });
      break;
    }

    default: {
      send({ type: "error", panelId: "", message: "알 수 없는 메시지 타입" });
    }
  }
}
