# DineSmart Deep Audit Report - 2026-04-26

Audit baseline: pulled `origin/main` first, fast-forwarded to `90a7738`.

Scope inspected: 261 tracked files, package manifests/locks, SQL schema and migrations, startup scripts, docs, frontend source/assets, backend routes/controllers/services/repositories/models, and local env presence. Generated/vendor output (`node_modules`, `frontend/dist`) was inventoried but not line-reviewed as source; dependency risk was covered with `npm audit`.

## Executive Summary

DineSmart is a promising full-stack product with meaningful feature breadth: user discovery, reservations, events, owner dashboards, admin moderation, loyalty, AI chat, and email flows. The main risk is not missing ambition; it is that too much production-critical behavior is implemented as large feature files, duplicated auth/config logic, ad hoc migrations, and global frontend state/styling. Before this pass the repo also contained a tracked Google OAuth client secret and known vulnerable dependencies.

This pass fixed the highest-signal safe issues: removed the tracked secret artifact from the working tree, added ignore rules and env examples, centralized JWT/CORS handling, removed predictable JWT fallbacks from backend source, made token blacklist checks fail closed, cleaned npm advisories to zero, fixed two frontend runtime bugs, and added low-risk image loading improvements.

## Priority Findings

### 1. Critical - Google OAuth client secret was committed

Location: `client_secret_888202221057-jqnkm37b33lm8d7pkq3v9niea4lcgk38.apps.googleusercontent.com.json`

Why it matters: this is a real OAuth secret artifact in source control. Removing it from the working tree is necessary but not sufficient because Git history may still expose it.

Fix implemented: file removed; `.gitignore:6` now ignores `client_secret_*.json`.

Required next step: revoke/rotate the Google OAuth client secret in Google Cloud, then purge the file from Git history if this repository has ever been pushed publicly or shared outside the team.

### 2. Critical - Predictable JWT fallback secrets existed in auth paths

Pre-fix locations: `backend/src/middleware/requireAuth.js:4`, `backend/src/middleware/authMiddleware.js:4`, `backend/src/services/authService.js:21`, `backend/src/controllers/authController.js:134`.

Why it matters: if `JWT_SECRET` is missing in production, attackers can forge valid tokens using the fallback string.

Fix implemented: `backend/src/config/security.js:13` now centralizes JWT secret loading and throws when `JWT_SECRET` is missing in production. Signing and verification now use `getJwtSecret()` in `backend/src/services/authService.js:60`, `backend/src/services/authService.js:339`, `backend/src/services/authService.js:351`, and `backend/src/utils/authTokens.js:17`.

### 3. High - Wildcard CORS allowed any origin with Authorization

Pre-fix location: `backend/src/app.js:8`.

Why it matters: a public API that accepts `Authorization` from every origin increases browser-side attack surface and makes production origin policy unenforceable.

Fix implemented: `backend/src/app.js:10` now reflects only configured allowed origins and rejects disallowed preflights. Configure `CORS_ORIGINS` or `FRONTEND_URL` in production.

### 4. High - Logout/token invalidation previously failed open

Pre-fix location: `backend/src/repositories/tokenBlacklistRepository.js:18`.

Why it matters: when the `token_blacklist` table is missing or inaccessible, invalidated tokens were treated as valid.

Fix implemented: `backend/src/repositories/tokenBlacklistRepository.js:21` now rethrows blacklist verification errors, and `backend/src/repositories/tokenBlacklistRepository.js:5` handles duplicate logout idempotently with `ON CONFLICT`.

### 5. High - JWTs are still stored in `localStorage`

Locations: `frontend/src/auth/AuthContext.jsx:13`, `frontend/src/auth/AuthContext.jsx:27`, `frontend/src/services/apiClient.js:4`, `frontend/src/components/ChatWidget.jsx:262`, `frontend/src/services/adminService.js:18`.

Why it matters: any XSS gives direct bearer-token access. This is one of the biggest remaining security risks.

Recommended fix: move auth to HttpOnly, Secure, SameSite cookies, or a backend-for-frontend session model. Keep in-memory access tokens only if cookies are not viable.

### 6. High - Email HTML injection risk

Locations: `backend/src/utils/emailSender.js:123`, `backend/src/utils/emailSender.js:507`, `backend/src/utils/emailSender.js:657`, `backend/src/utils/emailSender.js:658`, `backend/src/utils/emailSender.js:676`, `backend/src/utils/emailSender.js:677`.

Why it matters: names, restaurant names, rejection reasons, review comments, and admin notes are interpolated directly into email HTML. A malicious user/admin input can alter email markup and potentially phish recipients.

Recommended fix: add a small `escapeHtml()` helper and apply it to every dynamic HTML interpolation; keep raw values only in text bodies.

### 7. High - AI reservation tool bypasses primary reservation business logic

Locations: `backend/src/services/chatActions.js:165`, `backend/src/services/githubModelsService.js:359`.

Why it matters: AI booking uses a direct insert path instead of `reservationService`, so it can drift from core rules such as advisory locks, no-show bans, voucher/loyalty side effects, waitlist behavior, and email consistency.

Recommended fix: make AI tools call the same reservation application service used by HTTP routes.

### 8. High - Database schema is managed by loose SQL files and runtime table creation

Locations: `database/schema.sql`, `database/migration_*.sql`, `backend/src/repositories/chatRepository.js:6`, `backend/src/repositories/systemSettingsRepository.js:5`.

Why it matters: there is no migration runner, migration ledger, checksum, rollback, or environment promotion story. Runtime `CREATE TABLE IF NOT EXISTS` hides deployment drift and can fail under restricted DB permissions.

Recommended fix: adopt a real migration tool or a small custom migrations table with ordered files, checksums, CI validation, and a deploy command.

### 9. High - Frontend lint currently fails

Current result: `npm run lint` reports 48 errors and 20 warnings after this pass.

Examples: conditional hooks in `frontend/src/components/ReservationForm.jsx:320`, impure `Date.now()` render usage in `frontend/src/pages/User/UserDiscover.jsx:303`, hook state updates in effects across `App.jsx`, `ThemedSelect.jsx`, `OwnerShell.jsx`, and unused/dead state in several large pages.

Fixes implemented: removed the two `no-undef` runtime failures in `frontend/src/pages/User/UserProfile.jsx:457` and `frontend/src/pages/owner/OwnerReservations.jsx:347`.

Recommended fix: treat lint as a release gate, but split React Compiler rule cleanup from simpler unused-code cleanup to avoid risky broad rewrites.

### 10. High - Frontend bundle and asset weight are far above production expectations

Evidence: production build emits `mapbox-gl` at 1.70 MB minified, `index` at 507 KB minified, CSS at 265 KB, and cuisine/landing PNGs from 1.8 MB to 5.1 MB each.

Locations: `frontend/src/assets/cuisines/*.png`, `frontend/src/assets/landing/*.png`, `frontend/src/components/DiscoverCarousel.jsx:1`, `frontend/src/pages/User/UserExplore.jsx:3`, `frontend/src/pages/owner/OwnerProfile.jsx:2`.

Fix implemented: landing/carousel images now use `loading="lazy"` and `decoding="async"` in `DiscoverCarousel.jsx`, `LandingHighlights.jsx`, `EventsInviteSection.jsx`, and `ContactSection.jsx`.

Recommended fix: convert large PNGs to AVIF/WebP, use responsive `srcset`, lazy-load Mapbox routes only when the map tab is opened, and split CSS by route or feature.

## Architecture Findings

- `backend/src/services/reservationService.js` is 1,749 lines and mixes validation, availability, transactions, email, loyalty, waitlist, and owner operations. Severity: high. Extract capacity/slot availability, state transitions, notifications, loyalty, and waitlist into separate services with explicit transaction boundaries.
- `frontend/src/style.css` is 13,717 lines. Severity: high. It is a global cascade risk and makes visual regressions hard to isolate. Move toward route/component styles or CSS modules/design tokens.
- `frontend/src/pages/owner/OwnerReservations.jsx` is 1,744 lines and `frontend/src/pages/owner/OwnerProfile.jsx` is over 1,100 lines. Severity: high. Extract data hooks, filters, forms, dialogs, and charts.
- `backend/src/repositories/restaurantRepository.js` and `backend/src/repositories/adminRepository.js` use schema introspection to tolerate drift. Severity: medium. This makes migrations feel optional and hides broken environments.
- Root `package.json:2` contains Express/Mongoose dependencies that do not match the actual app architecture. Severity: medium. Convert the repo to npm workspaces or remove the root app package if unused.
- Dead/legacy frontend components appear unused: `frontend/src/components/RestaurantCard.jsx`, `AverageRatingDisplay.jsx`, `ReviewSection.jsx`, `NoResultsMessage.jsx`. Severity: low/medium. Remove or migrate them after confirming imports.
- `frontend/src/routes/ProtectedRoute.jsx:10` redirects to `/login`, but there is no `/login` route. Severity: medium. Use the existing auth modal/home route or remove the unused route helper.

## Frontend UX/UI Findings

- `frontend/src/pages/owner/OwnerNav.jsx:122` renders a burger button without an `onClick`, so owner mobile navigation is likely nonfunctional. Severity: high for mobile owner workflow.
- `frontend/src/components/ThemedSelect.jsx` is a custom select with limited keyboard behavior and lint-reported state-in-effect issues. Severity: medium. Add arrow-key navigation, `aria-activedescendant`, escape/blur handling, and tests.
- `frontend/src/components/ConfirmDialog.jsx` lacks robust focus trap/focus restore. Severity: medium. Use a proven dialog primitive or implement focus management.
- `frontend/src/hooks/useGeolocation.js:31` and `frontend/src/pages/User/UserExplore.jsx:113` call `ipapi.co` as a location fallback. Severity: medium. This sends user IP/location context to a third party; disclose it and make fallback opt-in.
- `frontend/src/components/Background.jsx` and related `.bg__glow` styles create decorative glow elements. Severity: low. Consider simplifying; they add paint cost and can distract from operational screens.
- Loading and error states exist unevenly. Some shells return `null` or placeholders; feature pages should use consistent skeleton/error components.

## Backend/Logic Findings

- `backend/src/utils/emailSender.js:16` and `backend/src/config/db.js:22` disable TLS certificate verification. Severity: high for production. Use provider CA validation or make this a development-only escape hatch.
- `backend/src/services/reviewService.js:54`, `backend/src/services/reviewService.js:112`, and `backend/src/services/moderation/moderationService.js:214` log raw review snippets. Severity: medium. Avoid logging user-generated content/PII; log IDs, labels, scores, and hashes instead.
- `backend/src/services/recommendationService.js` uses in-memory cache/cooldown state. Severity: medium. This will fragment under multiple instances; use Redis/runtime cache for shared state.
- `backend/src/services/subscriptionService.js` sends bulk emails through `Promise.all` without throttling. Severity: medium. Add concurrency limits, retry/backoff, and per-recipient status persistence.
- Auth is now less duplicated, but roles/authorization still live across multiple route files. Severity: medium. Define a consistent policy layer.

## DevOps/Infrastructure Findings

- No CI workflow exists. Severity: high. Add GitHub Actions for install, audit, backend tests, frontend lint/build.
- No deployment checklist validates required env vars. Severity: high. `backend/.env.example` and `frontend/.env.example` were added, but production should fail fast for DB, JWT, CORS, OAuth, email, and AI provider config.
- Startup scripts previously overwrote `.env`; now they preserve existing envs and generate a local JWT secret. Still, prefer documented setup commands over scripts that install and launch visible shells.
- No Docker/devcontainer. Severity: medium. Useful for Postgres parity and onboarding.
- No structured logging, request IDs, or monitoring integration. Severity: medium. Add pino/winston, request correlation, error tracking, and health endpoints.

## Performance Findings

- The Mapbox dependency dominates route chunks. Lazy-load map pages/tabs and consider static map previews where interactivity is not needed.
- Global CSS size is large enough to affect parse/style cost. Split or purge route-specific styles.
- Large PNGs should be converted to AVIF/WebP and served in responsive sizes.
- Search/recommendation APIs should be profiled with real data volumes; several repositories contain broad joins and dynamic filters that need `EXPLAIN ANALYZE` validation.
- Chat/AI routes should have rate limits, timeout budgets, and streaming cancellation handling.

## Security Findings

- Fixed: committed OAuth secret artifact removed from working tree and ignore rule added.
- Fixed: npm audit is clean for root, backend, and frontend.
- Fixed: JWT fallback strings removed from runtime auth code.
- Remaining: localStorage bearer tokens, unsanitized email HTML, TLS verification disabled, third-party geolocation fallback, raw UGC logging, no global rate limiting, no helmet/security headers, no request size limits beyond JSON body size.

## Product Quality Findings

- The product has strong feature coverage but weak workflow consistency. User, owner, and admin flows each solve similar UI problems separately.
- Owner operational pages are dense and powerful but need mobile navigation polish, predictable feedback, and smaller task-specific views.
- AI booking can be valuable, but it must use the same business rules as normal booking before it is investor-grade.
- Admin exports and moderation are useful; add audit trails, filter persistence standards, and operational dashboards around failures.

## Team Quality Findings

- File sizes and duplicated patterns suggest feature delivery outpaced shared standards.
- The repo lacks clear quality gates: lint fails, backend has one test file, and migrations are manual.
- Naming and data-shape normalization are inconsistent between snake_case DB rows and camelCase frontend DTOs.
- Docs are partially stale; README mentions older tech choices and generated diagrams/text should be refreshed.

## Quick Wins

1. Escape all dynamic email HTML in `backend/src/utils/emailSender.js`.
2. Remove or fix unused frontend state/imports flagged by ESLint.
3. Fix owner nav mobile burger behavior in `OwnerNav.jsx`.
4. Add `.github/workflows/ci.yml` for audit, test, lint, and build.
5. Convert the largest landing/cuisine PNGs to WebP/AVIF.
6. Remove root `package.json` dependencies or convert to npm workspaces.
7. Replace `ProtectedRoute` `/login` redirect with the actual auth entry point.
8. Add rate limiting and `helmet` to the backend.

## High-Impact Upgrades

1. Move auth to HttpOnly cookies and add CSRF strategy.
2. Create a migration runner with a `schema_migrations` table and CI validation.
3. Split reservation logic into domain services with focused tests.
4. Split owner/user/admin large pages into feature folders with hooks and components.
5. Add integration tests for booking, cancellation, moderation, login/logout, and AI booking.
6. Add observability: structured logs, request IDs, error tracking, and uptime/latency dashboards.

## Implemented In This Pass

- Pulled `origin/main` before continuing.
- Removed tracked Google OAuth client secret file and added `.gitignore` protection.
- Added `backend/.env.example` and `frontend/.env.example`.
- Added `backend/src/config/security.js` for JWT/CORS config.
- Added `backend/src/utils/authTokens.js` for shared token extraction/verification.
- Updated CORS handling in `backend/src/app.js`.
- Updated auth middleware, auth service, and logout token verification to use shared security utilities.
- Changed token blacklist checks to fail closed and made duplicate logout inserts idempotent.
- Updated startup scripts to preserve existing `.env` and generate local JWT secrets.
- Replaced weak JWT examples in older setup docs with strong-secret placeholders.
- Removed deprecated `crypto` npm dependency and updated `bcrypt` to `^6.0.0`.
- Ran `npm audit fix`; root/backend/frontend now report zero vulnerabilities.
- Fixed user required-review update flow by importing and calling `updateReview(restaurantId, reviewId, ...)`.
- Fixed owner reservation delete success state.
- Improved `apiClient` header merging and avoided forcing JSON headers on every request.
- Added lazy/async decoding to large landing/carousel images.

## Verification

- `npm audit --json` at root: 0 vulnerabilities.
- `npm audit --json` in `backend`: 0 vulnerabilities.
- `npm audit --json` in `frontend`: 0 vulnerabilities.
- `npm test` in `backend`: passed heuristic moderation tests.
- `node -e "require('./backend/src/app')"`: passed module load; warned only that `GOOGLE_CLIENT_ID` is unset in the shell.
- `npm run build` in `frontend`: passed with Vite 7.3.2; still warns about chunks above 500 KB.
- `npm run lint` in `frontend`: still fails with 48 errors and 20 warnings. This is a remaining release blocker.
- Dev server was started at `http://127.0.0.1:5173`; local HTTP fetch returned 200. Browser automation could not run because the `agent-browser` binary is not installed on PATH in this environment.

## Production Readiness Recommendation

Do not ship as production/investor-ready until the remaining high items are closed: rotate/purge the committed Google secret, replace localStorage JWTs, sanitize email HTML, add CI, introduce real migrations, fix frontend lint blockers, and reduce bundle/asset weight. After that, run an end-to-end test suite against a seeded staging database and capture performance budgets before demoing to investors.
