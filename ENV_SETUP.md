# Environment Variable Configuration

## Create the .env file

Create a `.env` (or `.env.local`) file at the root of the project with the following content:

```env
# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-replace-with-real-secret"

# Google OAuth (replace with your real values)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/notus_db"

# Email (Resend)
RESEND_API_KEY="your-resend-api-key"

# Environment
NODE_ENV="development"
```

## Obtaining Google OAuth Keys

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google People API or necessary OAuth scopes
4. Create OAuth 2.0 Credentials
5. Configure the Consent Screen
6. Add the Authorized Redirect URI: `http://localhost:3000/api/auth/callback/google`
7. Copy the Client ID and Client Secret into your `.env` file

## Generating a NextAuth Secret Key

You can generate a secret key using:

```bash
openssl rand -base64 32
```

Or use any random string of at least 32 characters.
