require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);

const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(__dirname, "data");
const DB_PATH = path.join(STORAGE_ROOT, "cms.sqlite");
const UPLOADS_DIR = path.join(STORAGE_ROOT, "uploads");

const questions = require("./questions");

fs.mkdirSync(STORAGE_ROOT, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_name TEXT NOT NULL,
      submitter_name TEXT NOT NULL,
      submitter_email TEXT,
      answers_json TEXT NOT NULL,
      image_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOADS_DIR));

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: STORAGE_ROOT,
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 12,
    },
  })
);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 60);
    cb(null, `${Date.now()}-${safeBase || "upload"}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image uploads are allowed."));
  },
});

function buildAnswersFromBody(body) {
  return questions.map((q) => ({
    id: q.id,
    label: q.label,
    value: String(body[q.id] || "").trim(),
  }));
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
    return;
  }
  res.redirect("/admin/login");
}

app.get("/", (_req, res) => {
  res.redirect("/submit");
});

app.get("/submit", (req, res) => {
  res.render("submit", {
    title: "Store Content Submission",
    questions,
    error: req.query.error || "",
    success: req.query.success || "",
  });
});

app.post("/submit", upload.single("photo"), (req, res) => {
  const storeName = String(
    req.body.store_number_location || req.body.store_name || ""
  ).trim();
  const submitterName = String(
    req.body.your_name || req.body.submitter_name || ""
  ).trim();
  const submitterEmail = "";

  if (!storeName || !submitterName) {
    res.redirect(
      "/submit?error=Your+name+and+store+number/location+are+required."
    );
    return;
  }

  const wantsPhoto = String(req.body.photo_permission || "").trim() === "Yes - I will upload it";
  if (wantsPhoto && !req.file) {
    res.redirect("/submit?error=Please+upload+a+photo+or+choose+No+for+photo.");
    return;
  }

  const answers = buildAnswersFromBody(req.body);
  const imagePath = req.file ? req.file.filename : null;

  db.run(
    `
      INSERT INTO submissions (store_name, submitter_name, submitter_email, answers_json, image_path)
      VALUES (?, ?, ?, ?, ?)
    `,
    [storeName, submitterName, submitterEmail, JSON.stringify(answers), imagePath],
    (err) => {
      if (err) {
        res.redirect("/submit?error=Could+not+save+submission.");
        return;
      }
      res.redirect("/submit?success=Thanks!+Your+submission+was+saved.");
    }
  );
});

app.get("/admin/login", (req, res) => {
  res.render("admin/login", {
    title: "Admin Login",
    error: "",
  });
});

app.post("/admin/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect("/admin");
    return;
  }

  res.status(401).render("admin/login", {
    title: "Admin Login",
    error: "Invalid username or password.",
  });
});

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});

app.get("/admin", requireAdmin, (_req, res) => {
  db.all(
    `
      SELECT *
      FROM submissions
      ORDER BY datetime(created_at) DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        res.status(500).send("Could not load submissions.");
        return;
      }

      const submissions = rows.map((row) => {
        let answers = [];
        try {
          answers = JSON.parse(row.answers_json);
        } catch (_e) {
          answers = [];
        }
        return {
          ...row,
          answers,
        };
      });

      res.render("admin/dashboard", {
        title: "Admin Dashboard",
        submissions,
      });
    }
  );
});

app.use((err, _req, res, _next) => {
  if (err && err.message) {
    res.status(400).send(err.message);
    return;
  }
  res.status(500).send("Unexpected server error.");
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`CMS running on http://localhost:${PORT}`);
});
