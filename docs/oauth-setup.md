# OAuth setup (Google + Apple)

Vyrn uses Supabase Auth. Email works out of the box.
Google and Apple need provider keys in the Supabase dashboard.

## Google
1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web)
2. Authorized redirect URI:
   `https://qgbpghtgcgzghpzoehrl.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → Google → enable
4. Paste Client ID + Client Secret
5. Optional: add `https://vyrn-fit.github.io` to Site URL / redirect allow list

## Apple
1. Apple Developer → Certificates, Identifiers & Profiles
2. Create Services ID with Sign in with Apple
3. Configure domains + return URL:
   `https://qgbpghtgcgzghpzoehrl.supabase.co/auth/v1/callback`
4. Create a key for Sign in with Apple
5. Supabase → Authentication → Providers → Apple → enable with Services ID, Team ID, Key ID, private key

Until configured, Google/Apple buttons show a clear message; Email + Demo accounts still work.
