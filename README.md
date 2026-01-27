# PriceWatch

쿠팡 상품 상세 URL 기반 옵션 최저가 모니터링 SaaS (MVP)

## Features
- 옵션별 표시가 수집 → 현재/7D/30D 최저가
- 가격 추이
- 최저가 갱신 시 Slack 알림
- 수동/주기 갱신 (5/10/30/60분)
- 브라우저 에이전트(크롬 확장) 기반 수집

## Quick Start
1) env 설정
2) DB 마이그레이션
3) 웹 실행
4) 크롬 확장 로드(개발자 모드)

## Env
See `.env.example`

## Notes
- 서버 스크래핑 금지
- 쿠폰/개인혜택 제외, 표시가만 사용
