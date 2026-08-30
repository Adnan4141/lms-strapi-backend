# LMS Backend (Strapi v5)

Strapi CMS for the Learning Management System. All business rules and **role-based access control (RBAC)** are enforced in custom controllers — not only via the admin UI permission toggles.

**Production:** [https://lms-strapi-backend-production.up.railway.app](https://lms-strapi-backend-production.up.railway.app)

## Stack

- Strapi **5.52.x**
- PostgreSQL (Neon / Railway) or SQLite for offline local dev
- TypeScript
- `pg` driver for Postgres
- JWT auth via `@strapi/plugin-users-permissions`

## Roles

| Role | Type | Capabilities |
|------|------|--------------|
| Admin | `admin` | Full platform control, users & stats |
| Content Manager | `content_manager` | Courses, lessons, quizzes, blog |
| Instructor | `instructor` | Own courses, lessons, quizzes |
| Student | `student` | Enroll, learn, take quizzes |

## Setup

```bash
npm install
cp .env.example .env
# Fill secrets + DATABASE_* + FRONTEND_URL (see below)
npm run develop
```

| URL | Purpose |
|-----|---------|
| `http://localhost:1337/api` | REST / custom API |
| `http://localhost:1337/admin` | Strapi Admin Panel |

On bootstrap (`src/index.ts`), the app seeds:

- Application roles + permissions
- Demo users
- Sample courses, lessons, quizzes, blog posts

Manual seed (loads Strapi and runs the same bootstrap logic):

```bash
npm run seed
```

## Demo accounts (after seed)

Password for **all** demo accounts: `Password123!`

| Role | Email | Display name |
|------|-------|--------------|
| Admin | `admin@lms.com` | Md Mokaddess Hossain Adnan |
| Content Manager | `manager@lms.com` | Emily Parker |
| Instructor | `instructor@lms.com` | John Doe |
| Instructor | `cameron@lms.com` | Robert Watson |
| Instructor | `eleanor@lms.com` | Sarah Mitchell |
| Instructor | `marcus@lms.com` | James Cooper |
| Student | `student@lms.com` | Alex Turner |

Quick login test:

```bash
curl -X POST http://localhost:1337/api/auth/local \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@lms.com","password":"Password123!"}'
```

## Environment

Copy from [`.env.example`](.env.example). Important variables:

| Variable | Purpose |
|----------|---------|
| `APP_KEYS`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, … | Strapi secrets (required) |
| `FRONTEND_URL` | Primary CORS origin (Vercel URL in production) |
| `CORS_ORIGINS` | Optional comma-separated extra origins (e.g. `http://localhost:3000`) |
| `DATABASE_CLIENT` | `postgres` or `sqlite` |
| `DATABASE_URL` | Postgres connection string (Neon / Railway) |
| `DATABASE_SSL` | `true` for Neon; often `false` for Railway private Postgres |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Usually `false` with Neon |

### Local Postgres (Neon example)

```env
DATABASE_CLIENT=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
FRONTEND_URL=https://lms-rbac-frontend.vercel.app
CORS_ORIGINS=http://localhost:3000
```

### Offline SQLite

```env
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db
```

### Password hashing

User passwords are stored with **bcrypt** via Strapi Document Service (`password` attribute). Seed / register / update flows never store plain text. Demo seed sets `provider: 'local'` so `/api/auth/local` works.

## Content types

| API | Collection |
|-----|------------|
| Courses | `api::course.course` |
| Lessons | `api::lesson.lesson` |
| Enrollments | `api::enrollment.enrollment` |
| Lesson progress | `api::lesson-progress.lesson-progress` |
| Quizzes / questions | `api::quiz.quiz`, `api::question.question` |
| Quiz attempts | `api::quiz-attempt.quiz-attempt` |
| Blog posts | `api::blog-post.blog-post` |
| Users | `plugin::users-permissions.user` + custom roles |

## Custom routes (high-signal)

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/session/me` | Authenticated profile |
| GET | `/api/catalog/courses` | Public published courses |
| GET | `/api/catalog/courses/:id` | Public course detail |
| GET | `/api/student/courses/:id/learning` | Enrolled student workspace |
| GET | `/api/student/courses/:id/quizzes/:quizId` | Take quiz (**no `correctAnswer`**) |
| GET | `/api/student/quizzes/:quizId/review` | Review **after** submit |
| GET | `/api/admin-dashboard/stats` | Admin only |
| GET/PUT/DELETE | `/api/admin-dashboard/users/*` | Admin user management |

Standard Strapi CRUD (`/api/courses`, `/api/lessons`, …) is wrapped with role checks in each controller.

## Quiz security model

1. **Taking a quiz:** `GET /api/student/courses/:courseId/quizzes/:quizId` — responses go through [`src/utils/question-sanitize.ts`](src/utils/question-sanitize.ts) and omit `correctAnswer`.
2. **Direct question API:** students get **403** on `GET /api/questions` and `GET /api/questions/:id`.
3. **Grading:** `POST /api/quiz-attempts` scores on the server using stored correct answers.
4. **Review:** `GET /api/student/quizzes/:quizId/review` exposes correct options only when a submitted attempt exists.

Staff (admin, content_manager, instructor on own courses) retain full question access including `correctAnswer`.

## Auth note

A global middleware resolves Bearer JWT and attaches `ctx.state.user` before Strapi’s content API auth. Controllers enforce the real **4-role** matrix. See comments in [`src/index.ts`](src/index.ts).

## Scripts

```bash
npm run develop   # local dev (alias: npm run dev)
npm run build     # production build
npm run start     # production server
npm run seed      # run bootstrap seed via scripts/seed.js
```

## Deploy (Railway)

| Setting | Value |
|---------|--------|
| Build | `npm run build` |
| Start | `npm run start` |
| Healthcheck | `/api/catalog/courses` |
| Do **not** set `PORT` | Railway injects it |

Required Railway variables: `NODE_ENV=production`, Strapi secrets, `DATABASE_CLIENT=postgres`, `DATABASE_URL`, SSL flags as needed, `FRONTEND_URL=https://lms-rbac-frontend.vercel.app`.

See [docs/RAILWAY_DEPLOY.md](../docs/RAILWAY_DEPLOY.md) for full deploy notes.

## Project layout

```
backend/
├── config/           database, middlewares (CORS), plugins
├── src/
│   ├── api/          content-types + custom controllers/routes
│   ├── index.ts      bootstrap: roles, permissions, demo seed
│   └── utils/        auth, question sanitize, quiz helpers
├── scripts/seed.js
├── railway.toml
└── .env.example
```

## Related docs

- [Frontend README](../frontend/README.md)
- [docs/](../docs/) — deploy, video walkthrough, Postman RBAC tests
