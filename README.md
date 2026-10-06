# Theme Park Wait-Time Dashboard

Collects live ride wait times from the public [ThemeParks.wiki](https://themeparks.wiki) API every
10 minutes, stores them in Postgres, and charts trends (e.g. best time of day to ride).
Unofficial fan project; not affiliated with Disney.

**Stack:** Angular · Node/TypeScript (Azure Functions) · Postgres · GitHub Actions → Azure

```
db/schema.sql          Postgres schema
api/                   Azure Functions (Node 22, TypeScript): timer ingestion now, REST endpoints next
web/                   Angular app (created with `ng new` on day 3)
.github/workflows/     ci.yml (test on PR) · deploy.yml (test + deploy on merge to main)
```

## Day 1 checklist

1. **Find the destination id.** Walt Disney World should be in the list:
   `curl -s https://api.themeparks.wiki/v1/destinations | jq '.destinations[] | {id,name,slug}'`
   Put the id in `DESTINATION_ID`.
2. **Run locally** (Docker Postgres):
   ```
   docker run -d --name pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=themepark -p 5432:5432 postgres:16
   psql postgres://postgres:postgres@localhost:5432/themepark -f db/schema.sql
   cd api && cp .env.sample .env     # fill in DESTINATION_ID
   npm install && npm run ingest:once
   ```
3. **Create Azure resources** (one resource group; names must be globally unique; if a flag
   differs, `az <command> --help` is the source of truth):
   ```
   az group create -n themepark-dash-rg -l eastus

   az postgres flexible-server create -g themepark-dash-rg -n <pg-name> -l eastus \
     --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
     --admin-user pgadmin --admin-password '<strong-password>' \
     --public-access 0.0.0.0 --high-availability Disabled
   az postgres flexible-server db create -g themepark-dash-rg -s <pg-name> -d themepark
   az postgres flexible-server firewall-rule create -g themepark-dash-rg -n <pg-name> \
     --rule-name my-ip --start-ip-address <your-ip> --end-ip-address <your-ip>
   psql "postgres://pgadmin:<pw>@<pg-name>.postgres.database.azure.com:5432/themepark?sslmode=require" -f db/schema.sql

   az storage account create -g themepark-dash-rg -n <storageacct> -l eastus --sku Standard_LRS
   az functionapp create -g themepark-dash-rg -n <func-name> --storage-account <storageacct> \
     --consumption-plan-location eastus --runtime node --runtime-version 22 \
     --functions-version 4 --os-type Linux
   ```
   If the CLI refuses a Linux Consumption app, create a **Flex Consumption** app instead
   (`--flexconsumption-location eastus`), and add `sku: flexconsumption` to the deploy step.
   **Check the Function App's pricing/free grant before leaving it running.**
4. **App settings** (DATABASE_URL has no `sslmode`; the code sets SSL):
   ```
   az functionapp config appsettings set -g themepark-dash-rg -n <func-name> --settings \
     DATABASE_URL='postgres://pgadmin:<pw>@<pg-name>.postgres.database.azure.com:5432/themepark' \
     DESTINATION_ID=<id>
   ```
5. **GitHub:** repo variable `AZURE_FUNCTIONAPP_NAME`; repo secret `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`
   (portal → Function App → Get publish profile). If deploy returns 401/403, enable SCM basic-auth
   publishing for the app (Configuration → General settings) or switch to OIDC login.
6. Push to `main`, watch the Actions run, then check the function's logs for "Ingested N snapshots".

## Cost guardrails (no spare money = read this)

- Budget alert at ~$5 in Cost Management (alerts notify; they do not stop spending).
- Postgres: Burstable B1ms, ≤32 GB, no high availability, no geo-redundant backup.
- The free Postgres offer lasts 12 months from signup. **Calendar reminder at month 11:** export
  the data, then delete the server (or move to Neon free) before it starts billing.
- Everything lives in `themepark-dash-rg`: `az group delete -n themepark-dash-rg` stops all billing.

## Roadmap

- [x] Ingestion (timer function) + schema + unit tests
- [ ] REST endpoints: `/api/parks`, `/api/attractions/:id/trend`, `/api/attractions/:id/best-times`
- [ ] Angular dashboard (line chart, heatmap, "best time to ride")
- [ ] Static Web App deploy, screenshots, architecture diagram
