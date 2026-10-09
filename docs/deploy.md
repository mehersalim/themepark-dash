# Deploying your own copy to Azure

These are the commands that worked for this project (Azure CLI 2.90, October 2026). Azure flags change between CLI
versions, so if one is rejected, `az <command> --help` is the source of truth.

Use one Terminal window so the variables persist. Pick names that are unique to you.

## 0. Prerequisites

Azure CLI, GitHub CLI (`gh`), Node 22.22.3+, an Azure subscription, and a GitHub repo containing this code.

Find the Walt Disney World destination ID:

```bash
curl -s https://api.themeparks.wiki/v1/destinations | jq '.destinations[] | select(.name|test("Disney";"i")) | {id,name}'
```

## 1. Resource group and database

```bash
RG=themepark-dash-rg
az group create -n $RG -l eastus

PG=themepark-pg-$RANDOM
PGPASS='choose-a-long-password-letters-and-digits'
LOC=centralus   # see "Region restrictions" below if this is rejected
az postgres flexible-server create --resource-group $RG --name $PG --location $LOC \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
  --admin-user pgadmin --admin-password "$PGPASS" --public-access 0.0.0.0 --yes
az postgres flexible-server db create -g $RG --server-name $PG --name themepark

# let your own machine connect, then load the schema
MYIP=$(curl -s https://api.ipify.org)
az postgres flexible-server firewall-rule create -g $RG --server-name $PG --name my-ip \
  --start-ip-address $MYIP --end-ip-address $MYIP
psql "host=$PG.postgres.database.azure.com port=5432 dbname=themepark user=pgadmin password=$PGPASS sslmode=require" -f db/schema.sql
```

Keep Burstable B1ms, 32 GB and no high availability to stay inside the free offer.

## 2. Function App (Flex Consumption)

```bash
STG=themeparkstg$RANDOM
FUNC=themepark-func-$RANDOM
az storage account create -g $RG -n $STG -l $LOC --sku Standard_LRS --allow-blob-public-access false
az functionapp create -g $RG -n $FUNC --storage-account $STG --flexconsumption-location $LOC \
  --runtime node --runtime-version 22 --instance-memory 512
az functionapp config appsettings set -g $RG -n $FUNC -o none --settings \
  "DATABASE_URL=postgres://pgadmin:$PGPASS@$PG.postgres.database.azure.com:5432/themepark" \
  "DESTINATION_ID=<your destination id>"
```

## 3. Static Web App for the dashboard

```bash
SWA=themepark-dash-web
az staticwebapp create -n $SWA -g $RG -l centralus --sku Free
az staticwebapp secrets list -n $SWA -g $RG --query properties.apiKey -o tsv \
  | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --repo <owner>/<repo>
```

Then allow the site to call the API (and your local dev server):

```bash
az functionapp cors add -g $RG -n $FUNC --allowed-origins https://<your-site>.azurestaticapps.net http://localhost:4200
```

Update `API_BASE` in `web/src/app/config.ts` to your Function App URL.

## 4. GitHub to Azure login (OIDC, no stored password)

```bash
SUB=$(az account show --query id -o tsv)
APPID=$(az ad app create --display-name themepark-dash-github --query appId -o tsv)
SPID=$(az ad sp create --id $APPID --query id -o tsv)
az role assignment create --assignee-object-id $SPID --assignee-principal-type ServicePrincipal \
  --role Contributor --scope /subscriptions/$SUB/resourceGroups/$RG
```

Create a federated credential. **The subject GitHub presents may include numeric IDs**
(`repo:OWNER@OWNER_ID/REPO@REPO_ID:ref:refs/heads/main`). If a deploy fails with `AADSTS700213`, copy the
exact subject from the error message and use that. A first attempt with `repo:OWNER/REPO:ref:refs/heads/main`
is rejected in that case.

```bash
cat > /tmp/fedcred.json <<JSON
{ "name": "github-main", "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:OWNER@OWNER_ID/REPO@REPO_ID:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"] }
JSON
az ad app federated-credential create --id $APPID --parameters /tmp/fedcred.json

gh secret set AZURE_CLIENT_ID --repo OWNER/REPO --body "$APPID"
gh secret set AZURE_TENANT_ID --repo OWNER/REPO --body "$(az account show --query tenantId -o tsv)"
gh secret set AZURE_SUBSCRIPTION_ID --repo OWNER/REPO --body "$SUB"
gh variable set AZURE_FUNCTIONAPP_NAME --repo OWNER/REPO --body "$FUNC"
```

Push to `main`; the Deploy workflow runs the tests and then deploys both parts.

## Things that went wrong (and the fixes)

| Symptom | Cause and fix |
|---|---|
| `The location is restricted from performing this operation` creating Postgres | The subscription is offer-restricted in that region. Check `az postgres flexible-server list-skus --location <region> --query "[0].reason" -o tsv`; an empty result means the region looks open. Central US worked here. |
| `unrecognized arguments: --high-availability Disabled` / `--database-name ... only with --node-count` | These flags are not valid for this CLI version or server type. Leave them out and create the database in a separate command. |
| `firewall-rule create` asks for `--server-name` | In this CLI the server is `--server-name` and the rule is `--name`. |
| `AADSTS530035: blocked by security defaults` | Re-run `az login --tenant <id> --scope https://management.core.windows.net//.default` (or the Graph scope for `az ad` commands) and approve MFA. |
| `AADSTS700213: No matching federated identity record` | The federated credential subject does not match the one GitHub presents. See step 4. |
| Homebrew refuses `azure-functions-core-tools` | Outdated Xcode Command Line Tools. Not required: deploy the API with `az functionapp deployment source config-zip` instead. |
| Browser shows CORS errors | Add the site's exact origin to the Function App's allowed origins (step 3). |
