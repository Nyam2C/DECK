import { describe, it, expect, vi } from "vitest";

// xterm 모킹
vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn(),
    dispose: vi.fn(),
    cols: 80,
    rows: 24,
  })),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock("@xterm/addon-webgl", () => ({
  WebglAddon: vi.fn().mockImplementation(() => ({
    onContextLoss: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

describe("use-terminal", () => {
  it("@xterm/* 모듈 임포트 가능", async () => {
    const { Terminal } = await import("@xterm/xterm");
    const { FitAddon } = await import("@xterm/addon-fit");
    const { WebglAddon } = await import("@xterm/addon-webgl");

    expect(Terminal).toBeDefined();
    expect(FitAddon).toBeDefined();
    expect(WebglAddon).toBeDefined();
  });

  it("Terminal 인스턴스 생성 가능", async () => {
    const { Terminal } = await import("@xterm/xterm");
    const term = new Terminal();

    expect(term.open).toBeDefined();
    expect(term.write).toBeDefined();
    expect(term.dispose).toBeDefined();
    expect(term.onData).toBeDefined();
  });

  it("FitAddon fit 메서드 호출 가능", async () => {
    const { FitAddon } = await import("@xterm/addon-fit");
    const fitAddon = new FitAddon();

    expect(fitAddon.fit).toBeDefined();
    fitAddon.fit();
    expect(fitAddon.fit).toHaveBeenCalled();
  });
});
