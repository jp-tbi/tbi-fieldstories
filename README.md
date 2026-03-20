# Field CMS (Render-ready)

Simple content management system for store teams to submit:
- A photo
- Story answers from a configurable question list

Admins can log in and review all submissions.

## 1) Configure questions

Edit `questions.js` and replace the starter questions with yours.

Each question supports:
- `id`: unique key
- `label`: question text
- `type`: `text` or `textarea`
- `required`: `true` or `false`

## 2) Local run

```bash
npm install
cp .env.example .env
npm start
```

Open:
- Submission form: <http://localhost:3000/submit>
- Admin login: <http://localhost:3000/admin/login>

## 3) Admin credentials

Set these in `.env` (or Render environment variables):
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

## 4) Render deployment

This project includes `render.yaml`.

Important:
- A persistent disk is configured and mounted at `/var/data`.
- SQLite database and uploaded images are stored there via `STORAGE_ROOT=/var/data`.

Deploy steps:
1. Push this folder to a GitHub repo.
2. In Render, create from Blueprint (or connect repo and use `render.yaml`).
3. Set `ADMIN_PASSWORD` in Render (it is marked as secret-only).
4. Deploy.

## Notes

- This starter uses session auth with username/password.
- For production hardening, consider:
  - Password hashing / SSO
  - Rate limiting on `/admin/login`
  - External object storage (S3-compatible) for images
