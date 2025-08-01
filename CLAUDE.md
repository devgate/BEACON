# CLAUDE.md

이 파일은 이 저장소에서 작업할 때 Claude Code (claude.ai/code)에게 가이드를 제공합니다.

## 프로젝트 개요

BEACON은 Flask 기반의 RAG (Retrieval-Augmented Generation) 채팅 애플리케이션으로 모던한 웹 인터페이스를 제공합니다. 이 애플리케이션은 다음과 같은 기능을 가진 문서 기반 질의응답을 위한 AI 어시스턴트 인터페이스를 제공합니다:

- 문서 관리 및 선택
- AI 응답이 포함된 실시간 채팅 인터페이스
- 날씨 위젯 통합
- 채팅 기록 추적
- 한국어 지원을 포함한 반응형 디자인

## 아키텍처

### 백엔드 (Flask)
- **app.py**: REST API 엔드포인트를 가진 메인 Flask 애플리케이션
  - `/` - 메인 HTML 인터페이스 제공
  - `/api/documents` - 문서 목록 반환
  - `/api/chat` - 간단한 응답 로직으로 채팅 메시지 처리
  - `/api/chat/history` - 채팅 기록 반환
  - `/api/weather` - 샘플 날씨 데이터 반환

### 프론트엔드
- **templates/index.html**: 반응형 레이아웃을 가진 메인 HTML 템플릿
- **static/script.js**: RAGManager 클래스를 사용하는 JavaScript 클라이언트
  - 채팅 상호작용 처리
  - 문서 선택 관리
  - 날씨 데이터 로드
  - 실시간 메시징 인터페이스 제공
- **static/style.css**: 다크 테마를 포함한 완전한 반응형 스타일링

### 데이터 구조
- id/title 구조를 가진 인메모리 리스트로 저장되는 문서
- timestamp/message 쌍으로 인메모리에 저장되는 채팅 기록
- 정적 샘플 데이터로 제공되는 날씨 데이터

## 개발 명령어

### 설정 및 설치
```bash
# 의존성 설치
pip install -r requirements.txt

# 애플리케이션 실행
python app.py
```

### 애플리케이션 실행
- **개발 서버**: `python app.py`
- **기본 URL**: http://localhost:5000
- **설정**: 디버그 모드 활성화, 모든 인터페이스에서 접근 가능 (0.0.0.0:5000)

### 의존성
핵심 Flask 스택:
- Flask 2.3.3
- Flask-CORS 4.0.0
- requests 2.31.0
- python-dotenv 1.0.0

## 코드 패턴

### Flask 라우트 구조
- 모든 API 라우트는 `/api/` 접두사 사용
- `jsonify()`를 사용한 JSON 응답
- POST 요청은 JSON 페이로드 예상
- 키워드 매칭 기반의 간단한 응답 로직

### 프론트엔드 JavaScript
- RAGManager를 사용한 클래스 기반 아키텍처
- 이벤트 기반 UI 상호작용
- 백엔드 통신을 위한 Fetch API
- 채팅 인터페이스를 위한 동적 DOM 조작

### 스타일링 접근법
- 테마를 위한 CSS 커스텀 속성
- Flexbox 기반 반응형 레이아웃
- 시안 (#00d4ff) 액센트 컬러를 가진 다크 테마
- 사이드바 토글을 포함한 모바일 우선 반응형 디자인

## 한국어 지원
- UI 요소와 응답이 한국어 텍스트 지원
- 샘플 데이터에 한국어 문서 제목 포함
- 비즈니스 컨텍스트를 위한 한국어/영어 혼합 사용자 인터페이스