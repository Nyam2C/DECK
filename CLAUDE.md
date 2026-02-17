# CLAUDE.md

LLM의 흔한 코딩 실수를 줄이기 위한 행동 가이드라인. 프로젝트별 지침과 병합하여 사용할 것.

**트레이드오프:** 이 가이드라인은 속도보다 신중함에 무게를 둔다. 사소한 작업에는 판단력을 활용할 것.

## 1. 코딩 전에 생각하라

**가정하지 마라. 혼란을 숨기지 마라. 트레이드오프를 드러내라.**

구현 전에:
- 가정을 명시적으로 밝혀라. 불확실하면 질문하라.
- 여러 해석이 가능하면 제시하라 - 조용히 하나를 고르지 마라.
- 더 단순한 접근법이 있으면 말하라. 필요하면 반론을 제기하라.
- 뭔가 불명확하면 멈춰라. 혼란스러운 부분을 짚어라. 질문하라.

## 2. 단순함 우선

**문제를 해결하는 최소한의 코드. 추측성 코드는 금지.**

- 요청받지 않은 기능 추가 금지.
- 한 번만 쓰이는 코드에 추상화 금지.
- 요청받지 않은 "유연성"이나 "설정 가능성" 금지.
- 불가능한 시나리오에 대한 에러 처리 금지.
- 200줄로 썼는데 50줄이면 될 것 같으면 다시 써라.

스스로에게 물어라: "시니어 엔지니어가 이걸 보고 과도하게 복잡하다고 할까?" 그렇다면 단순화하라.

## 3. 외과적 수정

**필요한 것만 수정하라. 자기가 만든 잔해만 정리하라.**

기존 코드를 편집할 때:
- 주변 코드, 주석, 포매팅을 "개선"하지 마라.
- 고장나지 않은 것을 리팩터링하지 마라.
- 기존 스타일에 맞춰라. 네가 다르게 하고 싶더라도.
- 관련 없는 데드 코드를 발견하면 언급만 하라 - 삭제하지 마라.

네 변경이 고아를 만들었을 때:
- 네 변경으로 인해 사용되지 않게 된 import/변수/함수는 제거하라.
- 기존에 있던 데드 코드는 요청받지 않는 한 제거하지 마라.

검증 기준: 변경된 모든 줄은 사용자의 요청에 직접 연결되어야 한다.

## 4. 목표 중심 실행

**성공 기준을 정의하라. 검증될 때까지 반복하라.**

작업을 검증 가능한 목표로 변환하라:
- "검증 추가" → "잘못된 입력에 대한 테스트를 작성하고 통과시켜라"
- "버그 수정" → "재현하는 테스트를 작성하고 통과시켜라"
- "X 리팩터링" → "리팩터링 전후로 테스트가 통과하는지 확인하라"

다단계 작업에는 간단한 계획을 명시하라:
```
1. [단계] → 검증: [확인사항]
2. [단계] → 검증: [확인사항]
3. [단계] → 검증: [확인사항]
```

강한 성공 기준은 독립적으로 반복 작업을 가능하게 한다. 약한 기준("되게 해줘")은 끊임없는 확인이 필요하다.

---

**이 가이드라인이 작동하고 있다면:** diff에서 불필요한 변경이 줄어들고, 과도한 복잡성으로 인한 재작성이 줄어들며, 실수 후가 아닌 구현 전에 명확화 질문이 나온다.

---

## 예시 모음

4가지 원칙을 보여주는 실제 코드 예시. 각 예시는 LLM이 흔히 저지르는 실수와 올바른 방법을 보여준다.

---

### 원칙 1 예시: 숨겨진 가정

**사용자 요청:** "사용자 데이터를 내보내는 기능을 추가해줘"

**LLM이 하는 것 (잘못된 가정)**

```python
def export_users(format='json'):
    """Export all users to a file."""
    users = User.query.all()

    if format == 'json':
        with open('users.json', 'w') as f:
            json.dump([u.to_dict() for u in users], f)
    elif format == 'csv':
        with open('users.csv', 'w') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'email', 'name'])
            writer.writeheader()
            writer.writerows([u.to_dict() for u in users])

    return f"Exported {len(users)} users"
```

**문제점:** 모든 사용자를 내보내야 한다고 가정, 파일 위치를 묻지 않고 가정, 어떤 필드를 포함할지 가정, 실제 데이터 구조를 확인하지 않고 CSV 필드명을 가정.

**올바른 방법 (가정을 드러내라)**

```
구현하기 전에 명확히 할 것들:

1. **범위**: 전체 사용자? 필터링된 부분집합? (개인정보 관련)
2. **형식**: "내보내기"가 의미하는 것은:
   - 브라우저에서 파일 다운로드?
   - 백그라운드 작업 + 이메일 알림?
   - 데이터를 반환하는 API 엔드포인트?
3. **필드**: 어떤 사용자 필드를? (민감한 정보가 있을 수 있음)
4. **볼륨**: 보통 사용자가 몇 명? (접근 방식에 영향)

가장 단순한 접근: 페이지네이션된 JSON을 반환하는 API 엔드포인트 추가.
어떤 방식을 원하시나요?
```

### 원칙 1 예시: 다양한 해석

**사용자 요청:** "검색을 더 빠르게 해줘"

**LLM이 하는 것 (조용히 하나를 선택)**

```python
# 어떤 "빠름"이 중요한지 묻지 않고
# 캐싱, DB 인덱스, 비동기 처리를 모두 추가
@lru_cache(maxsize=1000)
async def search(query: str) -> List[Result]:
    # ... 200줄의 최적화 코드
```

**올바른 방법**

```
"검색을 더 빠르게"는 여러 의미일 수 있습니다:

1. **응답 시간 단축** (500ms → 100ms 미만)
   - 데이터베이스 인덱스 추가
   - 자주 쓰는 쿼리 캐싱

2. **동시 검색 처리량 증가** (처리량)
   - async/await 추가
   - 커넥션 풀링

3. **체감 속도 향상** (UX)
   - 부분 결과를 즉시 보여주기
   - 프로그레시브 로딩

어떤 측면이 가장 중요한가요?
```

---

### 원칙 2 예시: 과도한 추상화

**사용자 요청:** "할인을 계산하는 함수를 추가해줘"

**LLM이 하는 것 (과잉 설계)**

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

class DiscountStrategy(ABC):
    @abstractmethod
    def calculate(self, amount: float) -> float:
        pass

class PercentageDiscount(DiscountStrategy):
    def __init__(self, percentage: float):
        self.percentage = percentage
    def calculate(self, amount: float) -> float:
        return amount * (self.percentage / 100)

class FixedDiscount(DiscountStrategy):
    def __init__(self, fixed_amount: float):
        self.fixed_amount = fixed_amount
    def calculate(self, amount: float) -> float:
        return min(self.fixed_amount, amount)

@dataclass
class DiscountConfig:
    strategy: DiscountStrategy
    min_purchase: float = 0.0
    max_discount: float = float('inf')

class DiscountCalculator:
    def __init__(self, config: DiscountConfig):
        self.config = config
    def apply_discount(self, amount: float) -> float:
        if amount < self.config.min_purchase:
            return 0
        discount = self.config.strategy.calculate(amount)
        return min(discount, self.config.max_discount)

# 단순한 계산에 30줄 이상의 설정이 필요
```

**올바른 방법 (단순하게)**

```python
def calculate_discount(amount: float, percent: float) -> float:
    """할인 금액 계산. percent는 0-100."""
    return amount * (percent / 100)

# 사용법
discount = calculate_discount(100.0, 10.0)  # $10 할인
```

**복잡성을 추가할 때:** 실제로 여러 할인 유형이 필요할 때만. 그 요구사항이 나중에 오면 그때 리팩터링하라.

### 원칙 2 예시: 추측성 기능

**사용자 요청:** "사용자 설정을 데이터베이스에 저장해줘"

**LLM이 하는 것 (불필요한 기능)** — 캐싱, 검증, 알림, 병합 옵션이 포함된 PreferenceManager 클래스 (아무도 요청하지 않은 기능에 30줄 이상)

**올바른 방법 (요청받은 것만)**

```python
def save_preferences(db, user_id: int, preferences: dict):
    """사용자 설정을 데이터베이스에 저장."""
    db.execute(
        "UPDATE users SET preferences = ? WHERE id = ?",
        (json.dumps(preferences), user_id)
    )
```

**나중에 필요하면 추가:** 캐싱 (성능이 문제될 때), 검증 (잘못된 데이터가 나타날 때), 병합 (요구사항이 생길 때).

---

### 원칙 3 예시: 지나가면서 리팩터링

**사용자 요청:** "빈 이메일이 검증기를 크래시시키는 버그를 고쳐줘"

**LLM이 하는 것 (너무 많이 변경)** — 버그 수정 범위를 넘어 이메일 검증 "개선", 사용자명 검증 추가, 주석 변경, 독스트링 추가.

**올바른 방법 (외과적)**

```diff
  def validate_user(user_data):
      # Check email format
-     if not user_data.get('email'):
+     email = user_data.get('email', '')
+     if not email or not email.strip():
          raise ValueError("Email required")

      # Basic email validation
-     if '@' not in user_data['email']:
+     if '@' not in email:
          raise ValueError("Invalid email")

      # Check username
      if not user_data.get('username'):
          raise ValueError("Username required")

      return True
```

**변경한 것:** 빈 이메일 처리를 수정하는 특정 줄만.

### 원칙 3 예시: 스타일 드리프트

**사용자 요청:** "업로드 함수에 로깅을 추가해줘"

**LLM이 하는 것** — 따옴표 스타일 변경, 타입 힌트 추가, 독스트링 추가, 공백 재포맷, boolean 리턴 로직 변경.

**올바른 방법 (기존 스타일에 맞춰서)**

```diff
+ import logging
+ logger = logging.getLogger(__name__)
+
  def upload_file(file_path, destination):
+     logger.info(f'Starting upload: {file_path}')
      try:
          with open(file_path, 'rb') as f:
              data = f.read()
          response = requests.post(destination, files={'file': data})
          if response.status_code == 200:
+             logger.info(f'Upload successful: {file_path}')
              return True
          else:
+             logger.error(f'Upload failed: {file_path}, status={response.status_code}')
              return False
      except Exception as e:
-         print(f"Error: {e}")
+         logger.exception(f'Upload error: {file_path}')
          return False
```

**맞춘 것:** 작은따옴표, 타입 힌트 없음, 기존 boolean 패턴, 들여쓰기 스타일.

---

### 원칙 4 예시: 모호한 것 vs 검증 가능한 것

**사용자 요청:** "인증 시스템을 고쳐줘"

**LLM이 하는 것 (모호한 접근)** — "코드 검토 → 문제 식별 → 개선 → 테스트" (명확한 성공 기준 없이 변경 진행)

**올바른 방법 (검증 가능한 목표)**

```
"인증 수정"을 위해 성공 기준을 정의해야 합니다.
문제가 "비밀번호 변경 후에도 로그인이 유지되는 것"이라면:

1. 테스트 작성: 비밀번호 변경 → 이전 세션 무효화 확인
   검증: 테스트 실패 (버그 재현)
2. 구현: 비밀번호 변경 시 세션 무효화
   검증: 테스트 통과
3. 엣지 케이스 확인: 다중 활성 세션, 동시 변경
   검증: 추가 테스트 통과
4. 회귀 확인: 기존 인증 테스트가 여전히 통과
   검증: 전체 테스트 스위트 그린
```

### 원칙 4 예시: 검증과 함께하는 다단계 작업

**사용자 요청:** "API에 속도 제한을 추가해줘"

**LLM이 하는 것** — Redis, 다중 전략, 설정 시스템, 모니터링을 300줄 커밋 하나에 전부 구현. 명확한 검증 단계 없음.

**올바른 방법 (점진적 + 검증)**

```
1. 기본 인메모리 속도 제한 추가 (단일 엔드포인트)
   검증: 테스트 100개 요청 → 처음 10개 성공, 나머지 429
2. 미들웨어로 추출 (모든 엔드포인트에 적용)
   검증: 기존 엔드포인트 테스트 여전히 통과
3. Redis 백엔드 추가 (다중 서버용)
   검증: 앱 재시작 후에도 속도 제한 유지
4. 설정 추가 (엔드포인트별 제한)
   검증: 설정 파일 파싱 정상

각 단계는 독립적으로 검증 및 배포 가능. 1단계부터 시작할까요?
```

---

## 안티패턴 요약

| 원칙 | 안티패턴 | 해결책 |
|------|---------|--------|
| 코딩 전에 생각하라 | 파일 형식, 필드, 범위를 조용히 가정 | 가정을 명시적으로 나열하고 명확화 질문 |
| 단순함 우선 | 단일 할인 계산에 Strategy 패턴 | 복잡성이 실제로 필요할 때까지 함수 하나 |
| 외과적 수정 | 버그 수정하면서 따옴표 재포맷, 타입 힌트 추가 | 보고된 문제를 수정하는 줄만 변경 |
| 목표 중심 | "코드를 검토하고 개선하겠습니다" | "버그 X에 대한 테스트 작성 → 통과시키기 → 회귀 없음 확인" |

## 핵심 통찰

"과도하게 복잡한" 예시들은 명백히 틀리지 않다 -- 디자인 패턴과 모범 사례를 따르고 있다. 문제는 **타이밍**이다: 필요하기 전에 복잡성을 추가하면 코드 이해가 어려워지고, 버그가 늘고, 구현이 느려지고, 테스트가 어려워진다.

**좋은 코드는 오늘의 문제를 단순하게 해결하는 코드이지, 내일의 문제를 성급하게 해결하는 코드가 아니다.**

---

## DECK 프로젝트 컨텍스트

- **스펙:** 전체 사양은 `DECK.md` 참조 (1,169줄)
- **데모:** `demo/index.html`에 인터랙티브 UI 목업 포함
- **스택:** Bun 1.2+ / TypeScript / React + Vite / xterm.js / node-pty / Zustand / Tailwind CSS v4
- **구조:** `backend/`와 `frontend/` 워크스페이스로 구성된 모노레포
- **린팅:** OXLint + OXFmt (Rust 기반)
- **테스트:** Vitest (70% 커버리지 목표)
