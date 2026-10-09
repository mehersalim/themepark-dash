# Theme Park Wait-Time Dashboard

[![Deploy](https://github.com/mehersalim/themepark-dash/actions/workflows/deploy.yml/badge.svg)](https://github.com/mehersalim/themepark-dash/actions/workflows/deploy.yml)

A full-stack analytics app that answers one question: **when is the best time to ride?**
It collects live Walt Disney World wait times every 10 minutes, stores them in Postgres, and charts
the patterns by hour of day and over time.

**Live demo:** https://orange-river-06eb3aa10.4.azurestaticapps.net
&nbsp;|&nbsp; **API:** https://themepark-func-10687.azurewebsites.net/api/parks

> Unofficial fan project. Not affiliated with or endorsed by Disney. Data from [ThemeParks.wiki](https://themeparks.wiki).

![Dashboard screenshot](docs/dashboard.png)

## How it works

```mermaid
flowchart LR
  TP["ThemeParks.wiki<br/>public API"] -->|"every 10 min"| ING
  subgraph FA["Azure Function App (Node 22, TypeScript)"]
    ING["Timer function<br/>ingest"]
    API["HTTP function<br/>REST API"]
  end
  ING -->|"insert snapshots"| DB[("Azure Database for PostgreSQL<br/>Flexible Server")]
  DB -->|"SQL aggregates"| API
  API -->|"JSON"| WEB["Angular dashboard<br/>Azure Static Web Apps"]
  GH["GitHub Actions"] -. "test, then deploy<br/>(OIDC login, no stored password)" .-> FA
  GH -. "build, then deploy" .-> WEB
```

1. **Ingest:** a timer-triggered Azure Function calls ThemeParks.wiki for every attraction and stores a snapshot
   (status and standby wait) in Postgres. Closed attractions are skipped.
2. **Analyse:** SQL groups readings by hour of day in the park's local time and computes the average and median wait.
   The "best time" is the hour with the lowest median, ignoring hours with fewer than 3 readings.
3. **Serve:** a small read-only REST API returns those results as JSON.
4. **Show:** an Angular app renders the best and busiest hours, a bar chart by hour of day, and a trend line over time.

## Tech stack

| Layer | Technology |
|---|---|
| Front end | Angular 22 (standalone components, signals), Chart.js, Vitest |
| API and ingestion | Node 22, TypeScript, Azure Functions v4 (Flex Consumption), `pg` |
| Database | PostgreSQL 16 (Azure Database for PostgreSQL Flexible Server) |
| Hosting | Azure Static Web Apps (front end), Azure Functions (API and timer) |
| CI/CD | GitHub Actions: tests with a real Postgres service container, deploy via Azure OIDC |

## API

All endpoints are read-only `GET` requests under `/api`.

| Endpoint | Returns |
|---|---|
| `/parks` | Parks with their attraction counts |
| `/attractions?parkId=<uuid>` | Attractions (optionally for one park), with the current wait if reported in the last 30 minutes |
| `/attractions/<id>/best-times?days=14` | Median and average wait for each hour of day, plus the best and worst hour |
| `/attractions/<id>/trend?days=7` | Hourly average and maximum wait over the last N days |
| `/health` | `{ "ok": true }` |

`days` accepts whole numbers from 1 to 90. Invalid IDs return `400`, unknown attractions `404`.

## CI/CD

- **Pull requests** run the CI workflow: API build and tests (including SQL tests against a throwaway Postgres
  container) and the Angular tests and production build.
- **Every merge to `main`** runs those same checks, and only if they pass deploys the API and the dashboard.
- GitHub logs in to Azure with **OpenID Connect (federated credentials)**, so there is no long-lived secret to leak.
  The Azure identity can only act on one resource group and only trusts this repository's `main` branch.

## Run it locally

You need Node 22.22.3+ (or 24.15+), Docker, and the `psql` client.

```bash
# 1. Database
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=themepark -p 5432:5432 postgres:16
psql postgres://postgres:postgres@localhost:5432/themepark -f db/schema.sql

# 2. API: collect one batch of data, then start the local dev server
cd api
cp .env.sample .env        # set DESTINATION_ID (see docs/deploy.md) and keep PGSSL_DISABLE=1
npm install
npm run ingest:once
npm run dev                # http://localhost:7071/api/parks

# 3. Dashboard (uses the deployed API by default; edit web/src/app/config.ts to use localhost)
cd ../web
npm ci
npm start                  # http://localhost:4200
```

Tests: `npm test` in `api/` and `npx ng test --watch=false` in `web/`. The SQL tests only run when
`TEST_DATABASE_URL` is set (CI sets it), so they can never touch a production database.

To deploy your own copy to Azure, see [docs/deploy.md](docs/deploy.md).

## Costs and limits

Built to run inside free tiers, but please read this before copying it:

- Azure's free account gives a **$200 credit for 30 days**, after which you must upgrade to pay-as-you-go to keep
  resources. The free Postgres hours (Burstable B1ms, 32 GB) last **12 months** from signup.
- Function App usage should stay well inside the Flex Consumption monthly free grant (about 4,300 runs a month),
  but check Cost Management after the first week and set a budget alert.
- The API is public and has no rate limiting; it is read-only, so the worst case is extra usage on your allowance.

## Known limitations

- Results are only as good as the data collected so far. Hours with few readings are shown in gray.
- Waits are the posted standby time. Lightning Lane and single-rider queues are not tracked.
- It tracks one resort (Walt Disney World). The ingest function takes the destination ID from configuration,
  so other ThemeParks.wiki destinations should work with little change.

## What I learned

*(Edit this section in your own words before sharing the repo.)*

- **Cloud free tiers have fine print.** My subscription was blocked from creating Postgres in several regions
  (`OfferRestricted`). I learned to read the CLI's capability output instead of retrying blindly, and found a region that worked.
- **Test the SQL, not just the code.** Unit tests with a mocked database passed, but the real confidence came from
  running the queries against a real Postgres in CI, in a throwaway database so tests never touch production data.
- **Keep logic out of the framework.** The router is plain TypeScript used by both the Azure Function and a local
  dev server, which made it easy to test and to run without Azure tools.
- **Passwordless deploys.** Setting up OIDC meant debugging an identity mismatch (GitHub now includes numeric IDs in the
  token subject), which taught me how federated credentials actually work.
- **Data quality is a design problem.** Many rides report no wait when closed, so the analysis filters those out and
  requires a minimum number of readings per hour before declaring a "best" time.

## License and attribution

Code is yours to use under the MIT license once you add a `LICENSE` file. Wait-time data comes from
[ThemeParks.wiki](https://themeparks.wiki); check their terms before heavy use.
