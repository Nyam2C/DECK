<h1><img src="electron/icons/icon.png" width="30" align="center" /> DECK</h1>

멀티 패널 AI 코딩 어시스턴트 터미널.

## 개요

여러 Claude Code CLI 세션을 하나의 대시보드에서 관리합니다. 최대 4개의 터미널 패널을 자동 그리드 레이아웃으로 배치하여 동시에 여러 작업을 수행할 수 있습니다.

## 주요 기능

- **4패널 반응형 그리드** — 패널 수에 따라 자동 배치 (1→2→2+1→2×2)
- **Claude Code CLI 연동** — 커스텀 명령어 지원
- **실시간 터미널 I/O** — WebSocket 기반
- **패널 상태 감지** — active / idle / input 상태 표시
- **세션 저장/복원** — 프리셋 관리
- **드래그 앤 드롭** — 패널 재배치
- **Leader Key 단축키** — `Ctrl+Space` 기반 키보드 내비게이션
- **Electron 데스크톱 앱** — 시스템 트레이 지원

## 기술 스택

| 영역          | 기술                                         |
| ------------- | -------------------------------------------- |
| Runtime       | Bun 1.2+                                     |
| Language      | TypeScript                                   |
| Frontend      | React 19, Vite 6, Tailwind CSS v4, Zustand 5 |
| Terminal      | xterm.js 6, node-pty                         |
| Communication | WebSocket (ws)                               |
| Desktop       | Electron 33                                  |
| Lint / Format | OXLint, OXFmt                                |
| Test          | Vitest                                       |

## 시작하기

### 사전 요구 사항

- [Bun](https://bun.sh) 1.2+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

### 설치 및 실행

```bash
# 의존성 설치
bun install

# 개발 서버 (backend + frontend 동시 실행)
bun run dev

# Electron 앱으로 실행
bun run electron:dev

# Electron 배포 빌드 (Windows: nsis / macOS: dmg / Linux: AppImage)
bun run electron:dist
```

## 스크립트

| 명령어                  | 설명                                |
| ----------------------- | ----------------------------------- |
| `bun run dev`           | 개발 서버 실행 (backend + frontend) |
| `bun run start`         | 프로덕션 서버 실행                  |
| `bun run build`         | 전체 빌드                           |
| `bun run test`          | 테스트 실행                         |
| `bun run test:watch`    | 테스트 워치 모드                    |
| `bun run test:coverage` | 커버리지 포함 테스트                |
| `bun run lint`          | OXLint 실행                         |
| `bun run fmt`           | OXFmt 포맷팅                        |
| `bun run typecheck`     | TypeScript 타입 체크                |
| `bun run electron:dev`  | Electron 개발 모드                  |
| `bun run electron:dist` | Electron 배포 빌드                  |

## 프로젝트 구조

```
DECK/
├── backend/              # Bun WebSocket 서버
│   ├── index.ts          # 엔트리포인트
│   ├── server.ts         # WebSocket 서버
│   ├── pty-manager.ts    # 터미널 프로세스 관리
│   ├── session-manager.ts# 세션 저장/복원
│   └── message-handler.ts# 메시지 라우팅
├── frontend/             # React SPA
│   └── src/
│       ├── components/   # Grid, Panel, Toolbar, Settings
│       ├── stores/       # Zustand 상태 관리
│       ├── services/     # WebSocket, 드래그, CLI
│       └── hooks/        # 커스텀 훅
├── electron/             # Electron 메인 프로세스
│   ├── main.ts           # 앱 엔트리포인트
│   ├── tray.ts           # 시스템 트레이
│   └── preload.ts        # preload 스크립트
└── package.json          # 루트 (워크스페이스 설정)
```

## 아키텍처

```
┌─────────────────────────────────────────┐
│  Electron                               │
│  ┌───────────────────────────────────┐  │
│  │  React (xterm.js × 4 panels)      │  │
│  └──────────────┬────────────────────┘  │
│                 │ WebSocket             │
│  ┌──────────────▼────────────────────┐  │
│  │  Bun Server                       │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐       │  │
│  │  │ PTY  │ │ PTY  │ │ PTY  │ ...   │  │
│  │  └──────┘ └──────┘ └──────┘       │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

브라우저(React)가 WebSocket으로 Bun 서버와 통신하고, 서버는 node-pty로 각 패널의 터미널 프로세스를 관리합니다.
