# Auth email templates

Paste these into the Supabase dashboard → **Authentication → Emails**:

| File | Dashboard template |
|---|---|
| `confirm-signup.html` | Confirm signup |
| `magic-link.html` | Magic Link |

Both show a 6-digit `{{ .Token }}` code. The login page (`src/app/login/page.tsx`)
takes the code and calls `verifyOtp({ email, token, type: "email" })`.
`confirm-signup.html` also keeps a `{{ .SiteURL }}/auth/confirm?...` link as a
fallback, handled by `src/app/auth/confirm/route.ts`.

Set **Site URL** and the redirect allow-list under Authentication → URL
Configuration to include the deployed domain and `http://localhost:3000`.
For code-based sign-in, also make sure **Enable email OTP** is on (Authentication
→ Providers → Email).
