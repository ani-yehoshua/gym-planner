# Email templates

These are pasted by hand into **Supabase Dashboard → Authentication → Emails**.
They're kept here so the branded versions are version-controlled.

| File | Dashboard template | Key vars |
| --- | --- | --- |
| `otp.html` | Magic Link (used as a 6-digit code) | `{{ .Token }}` |
| `change-email.html` | Change Email Address | `{{ .NewEmail }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}` |

## Notes

- `change-email.html` links to `{{ .SiteURL }}/auth/confirm?token_hash=…&type=email_change&next=/account`
  rather than the bare `{{ .ConfirmationURL }}`, so the confirm goes through the
  app's own `/auth/confirm` route (same pattern as the other flows).
- With **Secure email change** on (the default), Supabase sends this template to
  *both* the old and new address and both must be confirmed.
- The app triggers the change from Account → Email via
  `supabase.auth.updateUser({ email })` (`src/components/email-field.tsx`).
