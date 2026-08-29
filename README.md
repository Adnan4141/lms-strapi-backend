# LMS Backend (Strapi v5)

Strapi CMS for the LMS project. All business rules and **role-based access control** are enforced in custom controllers — not only via the admin UI permission toggles.

## Setup

```bash
npm install
cp .env.example .env
# Set APP_KEYS, JWT_SECRET, DATABASE_*, FRONTEND_URL
npm run develop
```

- API: `http://localhost:1337/api`
- Admin panel: `http://localhost:1337/admin`

On bootstrap, the app seeds 4 application roles (admin, content_manager, instructor, student), permissions, and sample content.

## Demo accounts (after seed)

| Role | Email | Password | Display name |
|------|-------|----------|--------------|
| Admin | admin@lms.com | Password123! | Md Mokaddess Hossain Adnan |
| Content Manager | manager@lms.com | Password123! | Emily Parker |
| Instructor | instructor@lms.com | Password123! | John Doe |
| Instructor | cameron@lms.com | Password123! | Robert Watson |
| Instructor | eleanor@lms.com | Password123! | Sarah Mitchell |
| Instructor | marcus@lms.com | Password123! | James Cooper |
| Student | student@lms.com | Password123! | Alex Turner |

## Environment

| Variable | Purpose |
|----------|---------|
| `FRONTEND_URL` | Primary CORS origin (Vercel URL in production) |
| `CORS_ORIGINS` | Optional comma-separated extra origins |
| `DATABASE_*` | PostgreSQL (Railway) or SQLite locally |

See `.env.example` for Strapi secrets (`APP_KEYS`, `JWT_SECRET`, etc.).

## Content types

- `course`, `lesson`, `enrollment`, `lesson-progress`
- `quiz`, `question`, `quiz-attempt`
- `blog-post`
- Users via `plugin::users-permissions.user` + custom roles

## Custom routes (high-signal)

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/session/me` | Authenticated user profile |
| GET | `/api/catalog/courses` | Public published courses |
| GET | `/api/student/courses/:id/learning` | Enrolled student workspace |
| GET | `/api/student/courses/:id/quizzes/:quizId` | Student quiz (**no correctAnswer**) |
| GET | `/api/student/quizzes/:quizId/review` | Student review (**after submit**) |
| GET | `/api/admin-dashboard/stats` | Admin only |
| GET/PUT/DELETE | `/api/admin-dashboard/users/*` | Admin user management |

Standard Strapi CRUD (`/api/courses`, `/api/lessons`, etc.) is wrapped with role checks in each controller.

## Quiz security model

1. **Taking a quiz:** students call `GET /api/student/courses/:courseId/quizzes/:quizId` — responses use [`question-sanitize.ts`](src/utils/question-sanitize.ts) and omit `correctAnswer`.
2. **Direct question API:** `GET /api/questions` and `GET /api/questions/:id` return **403** for students.
3. **Grading:** `POST /api/quiz-attempts` computes score on the server using stored correct answers.
4. **Review:** `GET /api/student/quizzes/:quizId/review` exposes `correctOption` only when a submitted attempt exists.

Staff (admin, content_manager, instructor on own courses) retain full access to questions including `correctAnswer` via REST.

## Auth note

A global middleware resolves Bearer JWT and attaches `ctx.state.user` before Strapi's content API auth. The **Public** role mirrors API permissions so authenticated requests succeed; **controllers enforce the real 4-role matrix**. See comment in [`src/index.ts`](src/index.ts).

## Scripts

```bash
npm run develop   # dev with auto-reload
npm run build     # production build
npm run start     # production server
```

## Further reading

- [Root README](../README.md) — full feature list and Postman RBAC tests
- [reference/LMS_Project_Full_Analysis_and_AI_Guideline.md](../reference/LMS_Project_Full_Analysis_and_AI_Guideline.md) — project spec
