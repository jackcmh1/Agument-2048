# 증강 2048 · MVP v0.1

React + TypeScript + Vite로 만든 4×4 증강 2048입니다. 서버나 계정 없이 동작합니다.

## 실행

Node.js 24 권장.

```sh
npm ci
npm run dev
```

브라우저에서 개발 서버가 안내하는 `/Agument-2048/` 경로를 엽니다.

```sh
npm test
npm run build
npm run preview
```

PC는 방향키/WASD, 모바일은 보드 위 스와이프를 사용합니다. 화면의 방향 버튼도 사용할 수 있습니다. 진행 중인 런은 브라우저 localStorage에 자동 저장됩니다. 새 게임 시 초기화됩니다.

## 규칙과 구현 선택

- 32, 64, 128, 256, 512, 1024 최초 달성 시 중복 없는 증강 3개 중 하나를 선택합니다.
- 8종: G01, G02, G03, M01, M02, B01, B02, R03. 등급에 관계없이 동일 확률로 제시합니다.
- M01/R03 발동 이후 각각 다음 4/8회의 유효 이동을 모두 대기합니다.
- M02는 현재 이동의 합성 결과를 보호하며, 제거 기회는 누적됩니다. 작은 숫자, 행 우선 좌표 순으로 제거합니다.
- B01/B02는 획득 직후 충전되어 있으며 사용 후 15/12회의 유효 이동이 필요합니다. B02는 선택한 행과 바로 아래 행을 교환합니다.
- 생성 취소는 일반 생성 카운터와 예고 숫자를 소비하지 않습니다. 시작 타일은 생성 카운터에서 제외합니다.
- 일반 이동이 불가능해도 충전된 유효 복구 능력이 있으면 플레이를 유지합니다.
- 첫 2048 달성 시 승리하며 무한 모드는 포함하지 않습니다.
- 런 기록 내보내기는 시드, 게임 상태, 최근 효과 로그와 발동 횟수를 JSON으로 저장합니다. 외부 수집은 없습니다.

게임 규칙은 `src/engine.ts`의 순수 상태 전이로 UI와 분리되어 있습니다. 카드 정의는 `cards`, 효과는 `applyAction`에 모여 있습니다. 새 카드 효과를 추가할 때 이동/합성 함수는 수정할 필요가 없습니다. `src/engine.test.ts`에서 핵심 규칙과 결정론을 검증합니다.

## GitHub Pages: Deploy from a branch

`.github/workflows/deploy.yml`은 main 푸시 시 설치 → 테스트 → 빌드 후 결과를 `gh-pages` 브랜치에 배포합니다. PR에서는 검증만 실행합니다. 첫 성공 배포 시 브랜치가 자동 생성됩니다.

1. 변경 사항을 GitHub의 main에 반영합니다.
2. Actions에서 `Validate and deploy Pages`가 성공했는지 확인합니다.
3. Settings → Pages → Source: **Deploy from a branch**.
4. Branch: **gh-pages**, Folder: **/ (root)** 선택 후 Save.
5. Pages 배포 완료 후 `https://jackcmh1.github.io/Agument-2048/`에 접속합니다.

저장소 정책에서 Actions의 브랜치 쓰기를 제한하면 Settings → Actions → General에서 워크플로 쓰기 권한을 허용해야 합니다. 저장소 이름을 바꾸면 `vite.config.ts`의 base도 수정합니다. 공개 사이트와 저장소 공개 여부는 GitHub 설정에 따릅니다.
