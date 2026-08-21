# ResMan connector foundation

Status: **not connected**. This repository contains an internal connector foundation, not a production ResMan integration and not a public integration claim.

## Provider access required

Apply through the [ResMan Partner Program](https://www.myresman.com/partner-with-resman/). ResMan states that approved partners can receive API access, training, support, and development instances.

CertivoIQ requires the following before a live connection can be enabled:

1. ResMan partner approval and an approved API use case.
2. A ResMan development instance.
3. The ResMan-issued API base URL.
4. An Integration Partner ID and API key.
5. Confirmation that the account/property and resident endpoints are included in the approved scope.
6. A successful authentication health check.
7. A reconciliation report with matching counts and unique external IDs.
8. Explicit production enablement.

## Server-only configuration

Configure these values as deployment secrets. Never place them in a browser environment variable, source file, database row, screenshot, issue, or pull request.

- `RESMAN_API_BASE_URL`
- `RESMAN_INTEGRATION_PARTNER_ID`
- `RESMAN_API_KEY`
- `RESMAN_ACCOUNT_ID` (when issued or required for the approved account)

The existing `pms_sync_connections.credentials_secret_name` column stores only a secret reference. It must never store the API key.

## Initial documented scope

The foundation allowlists only the initial read endpoints documented by ResMan:

- `Account/GetAccountID`
- `Account/GetProperties`
- `Leasing/GetApplicantsAndCurrentResidents`
- `Leasing/GetCurrentResidents`

Certification-document access and writing CertivoIQ review results back to ResMan are not implemented. Those capabilities require ResMan to confirm the relevant affordable-housing API methods and authorize them for CertivoIQ.

## Release gates

The connector remains internal and `displayPublicly: false` until all of these pass:

- issued credentials are configured in server secrets;
- authentication succeeds against the ResMan development instance;
- source and normalized record counts reconcile;
- all imported external IDs are unique within their entity type;
- rejected records are resolved;
- production access is explicitly enabled.

CSV exports or manual uploads are migration tooling, not a ResMan integration.
