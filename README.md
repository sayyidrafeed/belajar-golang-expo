# To-Dos

A personal task list built with Go and Expo. The same React Native UI runs on the web, Android, and iOS.

## Start locally

Requires Go 1.26 or newer and Node.js 24 LTS with npm. Both are already available on the machine used to scaffold this project.

From the project root:

```sh
npm ci
npm run dev
```

Open **http://localhost:8081**. The command starts the Go API on port 8080, waits for it to be healthy, then starts Expo on port 8081. `Ctrl+C` stops both processes. If the ports are already in use, it exits rather than taking over another process.

During the initial handoff these servers are already running. Reuse the URL rather than launching a second session.

For Expo Go on a phone:

1. Stop the existing dev command before switching modes.
2. Install Expo Go on the phone, then connect the phone and laptop to the same Wi-Fi network.
3. Run `npm run dev:mobile` from the root and scan the terminal QR code. Android scans through Expo Go; iPhone scans through Camera.
4. For a physical iPhone, sign in to Expo Go and the Expo CLI with the same Expo account. Run `npx expo login` from `apps/mobile` to sign in on the laptop.

The dev script sets `EXPO_PUBLIC_API_URL` to the laptop's LAN address. The terminal prints that address. If the script chooses the wrong network interface, override it before starting:

```sh
EXPO_PUBLIC_API_URL=http://192.168.1.10:8080 npm run dev:mobile
```

Replace the example IP with the laptop's address. `localhost` on a phone points to the phone, not the laptop. A Wi-Fi network that isolates clients can block local connections. An Expo tunnel forwards Metro traffic only; it does not automatically expose the Go API.

Saving frontend code triggers Expo Fast Refresh. For Go changes, stop and restart the dev command. Android/iOS bundles compile, but physical-device behavior still needs manual UAT. Expo Go must support the project's Expo SDK 57.

## What works

- Quick add from the main input, with Enter or the Add button.
- Create and edit task titles, notes, priority, and optional due dates.
- Complete a task and reopen it from Completed.
- Delete a task after an explicit confirmation. Cancel keeps the task and editor draft.
- Search titles and notes within the selected view.
- View active tasks, today/overdue, upcoming, high-priority, and completed tasks.
- Sort by due date, newest, or title. The sort button cycles through the three choices.
- Refresh manually, or return to the app to refresh the list.
- Keep data after refreshing the browser or restarting the API.
- Loading, empty, filtered-empty, connection-error, and save-error states. Failed saves keep the draft.

**All tasks shows active tasks.** Completed tasks have their own view. Today includes unfinished tasks whose due date is today or earlier. Upcoming includes unfinished tasks dated after today. Dates use the device's local calendar day; they are stored as `YYYY-MM-DD` without a time zone.

Quick add assigns today's date in Today and high priority in High priority. Otherwise it creates a normal-priority task without a date. Adding from Upcoming or Completed switches to All tasks so the new task is visible. Detailed creation always switches to All tasks.

Data lives in a SQLite database at `apps/api/data/todos.db` (WAL mode), which is excluded from Git. The store uses a single connection, so writes are serialized and transactional; a failed write changes nothing. A corrupt database stops startup rather than being overwritten. On first start, tasks from a legacy `todos.json` next to the database are imported once, only if the database is empty.

This is a local, single-user app with one API process. There is no login, cloud sync, or offline write queue. The default API binds to the local network for phone testing. SQLite supports one API process; do not run multiple instances against the same file.

## Manual UAT

Use the browser at http://localhost:8081. These checks are for the human reviewer; no browser automation or Playwright suite is included.

| Journey | Action | Expected result |
| --- | --- | --- |
| First run | Open the app | A fresh-page empty state, zero counts, working add controls |
| Quick add | Type `Plan the weekend`, press Enter | Task appears once and the input clears after the successful response |
| Validation | Submit a blank title | A useful validation message; no task created |
| Detailed creation | New task; add notes, high priority, and Tomorrow | Task appears in All tasks, Upcoming, and High priority |
| Edit | Click a task title; change title/notes; Save changes | Updated details remain after browser refresh |
| Date validation | Enter `2026-02-30` and save | Invalid date rejected; draft stays in the editor |
| Today | Create a task with Today and another with a past date | Both appear in Today; the past task is marked overdue |
| Completion | Check a task | It leaves the active view and appears in Completed; counts update |
| Reopen | Uncheck that task in Completed | It returns to the appropriate active views |
| Search | Search for a word in a task's notes | Matching tasks remain; clear search restores the view |
| Search empty | Search an absent word | Specific empty state and a working Clear search button |
| Sort | Click Sort repeatedly | Due date, Newest, and A–Z produce the corresponding order |
| Delete cancellation | Edit a task; Delete task; Keep task | Task and editor draft remain |
| Delete | Edit a task; Delete task; Yes, delete task | Task disappears; it stays deleted after refresh |
| Persistence | Add/edit/complete a task; stop and restart `npm run dev` | Saved state survives the restart |
| Failure | Stop dev servers; try a mutation in the open browser | Connection error appears; no false success; the draft stays |
| Recovery | Restart dev servers; Try again or Refresh | Saved list returns; retry the preserved draft |
| Keyboard | Tab through controls; Enter/Space; open editor; Escape | Visible focus; usable controls; editor closes when not saving |
| Small screen | Resize to about 390 px wide | Scrollable view tabs, readable task content, reachable form actions |
| Phone | Repeat create/edit/complete in Expo Go | Same data as web after refresh; keyboard and safe areas remain usable |

Changes from another browser/device appear after Refresh or when returning to the app. The app serializes mutations within one client and waits for the API response before showing success.

## Structure

```text
apps/api/
  cmd/api/                 startup, HTTP server, CORS, shutdown
  internal/todo/           model, handler, service, SQLite store, focused Go tests
apps/mobile/
  src/App.tsx              responsive workspace and view state
  src/components/          shared controls and visual tokens
  src/features/todos/      task types, API calls, data hook, task/editor components
  src/lib/api.ts           HTTP transport and connection errors
  src/platform.web.ts      browser viewport, focus, and touch defaults
scripts/dev.mjs            local process launcher and LAN configuration
```

The app currently has one screen, so it does not need a routing dependency. The Go service owns task rules; the handler translates HTTP/JSON; the SQLite store owns persistence.

## API

| Method | Path | Response |
| --- | --- | --- |
| GET | `/health` | `200`, `{"status":"ok"}` |
| GET | `/todos` | `200`, `{"todos": [...]}` including completed tasks |
| POST | `/todos` | `201`, created task and `Location` header |
| GET | `/todos/{id}` | `200`, task; `404` if absent |
| PATCH | `/todos/{id}` | `200`, updated task; accepts partial fields |
| DELETE | `/todos/{id}` | `204`; `404` if absent |

POST fields are `title`, `notes`, `priority`, and `dueDate`. PATCH also accepts `completed`. Title is required and limited to 180 Unicode characters, notes to 4,000. Priority is `low`, `normal`, or `high`. Use an empty due-date string to remove a date. Mutations require `Content-Type: application/json`; malformed JSON, unknown fields, and invalid values are rejected.

```sh
curl -X POST http://localhost:8080/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"Plan the weekend","priority":"normal","dueDate":""}'
```

API configuration uses environment variables: `API_ADDR`, `TODOS_DB` (default `data/todos.db`), `TODOS_FILE` (legacy JSON import path), and comma-separated `CORS_ORIGINS`. No dotenv loader is used in Go. Frontend `EXPO_PUBLIC_*` values are public app configuration, never secrets.

## Verification

```sh
npm run typecheck
npm run test:api
cd apps/api && go vet ./...
```

Go tests cover the HTTP CRUD journey, validation, false/empty PATCH values, concurrent updates, persistence after reopen, rolled-back updates, corrupt-database handling, legacy JSON import, and CORS. There is no frontend unit-test framework, browser E2E framework, Playwright config, test browser binary, or automated UI-acceptance claim.

An Expo export validates JS bundling for web, Android, and iOS; it is not an APK/AAB/IPA build or physical-device acceptance. Manual browser and phone UAT remain the user's checks.

The initial npm audit reports transitive advisories in the Expo/React Native toolchain, including braces, node-forge, and uuid. npm's proposed forced fix downgrades Expo/React Native across major versions, so it was not applied. This local learning app has not been assessed for a production release.
