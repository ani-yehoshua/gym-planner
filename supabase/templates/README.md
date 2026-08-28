# Auth email templates

Paste these into the Supabase dashboard → **Authentication → Emails**:

| File | Dashboard template | Link `type` |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `signup` |
| `magic-link.html` | Magic Link | `magiclink` |

Both link to `{{ .SiteURL }}/auth/confirm?token_hash=…&type=…`, handled by
`src/app/auth/confirm/route.ts` (calls `verifyOtp` then redirects to `/`).

Make sure **Site URL** and the redirect allow-list under
Authentication → URL Configuration include the deployed domain and
`http://localhost:3000` for local dev.
