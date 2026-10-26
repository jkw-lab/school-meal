# School Meal

A minimal, iPhone-inspired school meal archive with nutrition and menu analytics. Independent from the original school-information app.

## Features

- Seven-day calendar (including weekend meals), breakfast/lunch/dinner, school search.
- NEIS original meal text, allergens and nutrition sources archived in PostgreSQL. Menu names are split, lightly canonicalized and assigned transparent rule-based categories.
- 2025 KDRI 15–18y male/female *reference comparison*, not a personal target or nutrition status judgement. One serving = planned provision, not confirmed consumption. Only NEIS-provided nutrient items are shown.
- Overview, menu frequency (top 30, repeat intervals), weekday × meal-type category occurrence heatmap, weekdays vs weekend, nutrient averages and macro energy mix, monthly nutrition/variety trends.
- Historical incremental backfill (one 30-day window daily by default) plus the current rolling 28 days; sources can change and the database records revisions when values change.
- Server-side caching, client weekly cache, skeleton loading, reduced-motion support, iOS safe areas.

## Environment

`DATABASE_URL`, `NEIS_API_KEY`, `CRON_SECRET` must be set as **Vercel server environment variables**; do not commit secrets.
Scheduled endpoint: `/api/cron/sync` at 20:10 UTC (=05:10 KST) via Vercel. It requires `Authorization: Bearer <CRON_SECRET>`.

## Database

1. Apply `migrations/002_analytics.sql` to the existing Neon database. It is additive and preserves existing meals.
2. The app's first fresh lookup fills `meal_items` for that date range; scheduled backfill indexes older ranges.
3. `/api/status` exposes archival progress and latest synchronization run.
4. For another school, browsing menus stores the selected period; scheduled archival currently focuses on default school (북일고).

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

See `.env.example`. `npm run build` runs type validation through Next.

## Reference and caveats

- 보건복지부·한국영양학회. (2025). *2025 한국인 영양소 섭취기준* (공식 자료, 2026 정오표 반영): https://www.kns.or.kr/fileroom/fileroom_view.asp?BoardID=Kdr&idx=167
- NEIS: https://open.neis.go.kr
- 2025 KDRI recommended daily intake values for ages 15–18 used in UI:
  - Male: protein 65g, calcium 800mg, iron 11mg, vitamin C 100mg, thiamin 1.3mg, riboflavin 1.7mg.
  - Female: protein 55g, calcium 700mg, iron 12mg, vitamin C 100mg, thiamin 1.1mg, riboflavin 1.2mg.
- Ratio is `meal nutrient provision / daily RNI × 100`, **not** a per-meal target and not a deficiency or health score. Energy intake and absent nutrients cannot be inferred from the menu.
- A category heatmap rate counts meals containing a category divided by meals recorded in that weekday/type slot; users should mind small samples.
- Backfill can only retrieve records still returned by NEIS. Unsupplied nutrient values must not be estimated.

## Menu favorites (free, no user accounts)

- Tap ☆ next to an item in a meal, top-menu ranking, or menu search results. Saved ★ items appear in **즐겨찾기**.
- Favorites use each device/browser's `localStorage`, scoped to the selected school. They are **not synced between devices**, and clearing browsing data resets the list. No favorite records are added to Neon.
- The selected menu's history is queried read-only from Neon via `/api/menu-stats`; `/api/menu-search` searches normalized menu names already archived. Statistics include past meals through today only. Upcoming scheduled meals are listed separately.
- Query filters use exact normalized names; school/day/time counts remain contingent on NEIS archive coverage.
