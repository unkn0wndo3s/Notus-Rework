# Notus - Next.js Application with Authentication

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the `env.template` file to `.env` and configure your credentials:

```bash
cp env.template .env
```

### 3. Database Configuration

#### Option A: Simulation mode (no database)

The application works in simulation mode without a database. Forms are validated but data is not persisted.

#### Option B: With PostgreSQL & Prisma

1. **Install PostgreSQL** and create a database:

```sql
CREATE DATABASE notus_db;
```

2. **Configure the `.env` file** with your database URL:

```env
DATABASE_URL=postgresql://username:password@host:port/database
AUTH_SECRET=your-secret-key
```

3. **Initialize the database**:

```bash
npx prisma generate
npx prisma db push
```

### 4. Google OAuth Configuration (Optional)

To enable Google OAuth authentication:

1. **Follow the guide** in `ENV_SETUP.md`
2. **Add the variables** to your `.env` file:

```env
# Base URL (REQUIRED for NextAuth.js)
NEXTAUTH_URL=http://localhost:3000

# Google OAuth Keys
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
```

⚠️ **Important**: `NEXTAUTH_URL` is **required** for Google OAuth to work correctly.

### 5. Start the application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 📁 Project Structure

```
notus/
├── prisma/                 # Prisma schema and migrations
├── src/
│   ├── app/                # Next.js App Router (pages and API)
│   │   ├── (auth)/         # Login, Register, Forgot Password
│   │   ├── (main)/         # Dashboard, Profile, Folders
│   │   └── api/            # API Routes
│   ├── components/         # React Components
│   ├── contexts/           # React Contexts
│   ├── hooks/              # Custom Hooks
│   ├── lib/
│   │   ├── actions/        # Server Actions
│   │   ├── repositories/   # Data access layer (Prisma)
│   │   ├── services/       # Business logic layer
│   │   └── auth/           # NextAuth.js configuration
│   └── types/              # Type definitions
├── public/                 # Static assets
├── middleware.ts           # Route protection
└── env.template            # Configuration template
```

## 🔐 Features

- ✅ **Registration** with full validation
- ✅ **Secure Login** with NextAuth.js
- ✅ **Google OAuth Authentication** (registration and login)
- ✅ **Document Management** with real-time editing
- ✅ **Folder Organization** for documents
- ✅ **Email Notifications** for password reset
- ✅ **Admin Dashboard** for user management
- ✅ **Responsive UI** with Tailwind CSS v4

## 🛠️ Technologies

- **Next.js 15** with App Router & Turbopack
- **NextAuth.js v4** for authentication
- **Prisma** (ORM) with **PostgreSQL**
- **Tailwind CSS v4** for styling
- **TypeScript** for type safety
- **Bcrypt.js** for password hashing
- **Zod** for validation
- **Socket.io** for collaborative features

## 📝 Notes

- In simulation mode, data is not persisted.
- For production, configure PostgreSQL and generate a secure `AUTH_SECRET`.
- The application uses secure cookies for sessions.
