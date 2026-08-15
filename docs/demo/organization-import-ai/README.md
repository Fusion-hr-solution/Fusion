# AI-assisted Organization Import demo

Use `customer-organization-vocabulary.xlsx` for the presentation journey. Its organization levels use customer vocabulary that deterministic interpretation cannot assign to Fusion types on its own:

- `Entity` → `Organization`
- `Strategic Pillar` → `Division`
- `Capability` → `Department`
- `Delivery Pod` → `Team`

The workbook contains organization structure only. It has no employee data, Fusion identifiers, secrets, or hidden worksheets.

## Local Groq secret

Set the key only in the CoreHR server process environment. Do not add it to an appsettings file or expose it to the frontend.

```powershell
$env:GROQ_API_KEY = "<your-local-key>"
dotnet run --project Backend/EY.HRPlatform.CoreHR
```

CoreHR uses Groq model `openai/gpt-oss-120b` by default. If `GROQ_API_KEY` is absent, CoreHR still starts and Organization Import remains available for deterministic and manual review.

## Shell-based demo

1. Start the native Fusion services and frontend described in `AGENTS.md`.
2. Open `http://localhost:3000` and sign in.
3. Go to Organization, choose **Import structure**, and upload `docs/demo/organization-import-ai/customer-organization-vocabulary.xlsx`.
4. Confirm the restrained **Interpreting unfamiliar organization terms…** state appears.
5. Open **suggestions to review** and check or change each proposed meaning.
6. Choose **Apply suggestions** once. The resulting Organization hierarchy should replace the unresolved state and the suggestion UI should recede.
7. Continue normal review, choose **Complete import**, and verify the canonical Organization hierarchy.
8. Refresh or reopen the import before applying to confirm the same persisted attempt returns without another Groq request.

For the manual-fallback check, start CoreHR once without `GROQ_API_KEY`, upload the same workbook, and use **Review manually**. Do not simulate Groq outages or rate limits in this presentation path; focused automated tests cover those behaviors.
