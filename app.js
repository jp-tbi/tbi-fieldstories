require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const bcrypt = require("bcryptjs");
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
const SUPPORTED_LANGS = new Set(["en", "fr"]);

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
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCb(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

async function getMetaValue(key) {
  const row = await dbGet("SELECT value FROM admin_meta WHERE key = ?", [key]);
  return row ? row.value : null;
}

async function setMetaValue(key, value) {
  await dbRun(
    `
      INSERT INTO admin_meta (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `,
    [key, value]
  );
}

async function ensureAdminCredential() {
  const existing = await dbGet(
    "SELECT username FROM admin_credentials WHERE username = ?",
    [ADMIN_USERNAME]
  );
  if (existing) {
    return;
  }
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await dbRun(
    `
      INSERT INTO admin_credentials (username, password_hash)
      VALUES (?, ?)
    `,
    [ADMIN_USERNAME, hash]
  );
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/assets", express.static(__dirname));
app.use("/uploads", express.static(UPLOADS_DIR));

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: STORAGE_ROOT,
    }),
    secret: SESSION_SECRET,
    proxy: process.env.NODE_ENV === "production",
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

function getLang(value) {
  const lang = String(value || "en").toLowerCase();
  return SUPPORTED_LANGS.has(lang) ? lang : "en";
}

function i18nText(value, lang) {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    return value[lang] || value.en || "";
  }
  return "";
}

function uiText(lang, key) {
  const texts = {
    requiredError: {
      en: "Your name and store number/location are required.",
      fr: "Votre nom et le numero/emplacement du magasin sont obligatoires.",
    },
    photoRequiredError: {
      en: "Please upload a photo or choose No for photo.",
      fr: "Veuillez televerser une photo ou choisir Non pour la photo.",
    },
    saveError: {
      en: "Could not save submission.",
      fr: "Impossible d'enregistrer la soumission.",
    },
    saveSuccess: {
      en: "Thanks! Your submission was saved.",
      fr: "Merci! Votre soumission a ete enregistree.",
    },
  };
  return texts[key][lang] || texts[key].en;
}

function buildAnswersFromBody(body, lang) {
  return questions.map((q) => ({
    id: q.id,
    label: i18nText(q.label, lang),
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
  const lang = getLang(req.query.lang);
  res.render("submit", {
    title: lang === "fr" ? "Soumission de contenu magasin" : "Store Content Submission",
    questions,
    lang,
    error: req.query.error || "",
    success: req.query.success || "",
  });
});

app.post("/submit", upload.single("photo"), (req, res) => {
  const lang = getLang(req.body.lang);
  const storeName = String(
    req.body.store_number_location || req.body.store_name || ""
  ).trim();
  const submitterName = String(
    req.body.your_name || req.body.submitter_name || ""
  ).trim();
  const submitterEmail = "";

  if (!storeName || !submitterName) {
    const error = encodeURIComponent(uiText(lang, "requiredError"));
    res.redirect(`/submit?lang=${lang}&error=${error}`);
    return;
  }

  const wantsPhoto = String(req.body.photo_permission || "").trim() === "yes_upload";
  if (wantsPhoto && !req.file) {
    const error = encodeURIComponent(uiText(lang, "photoRequiredError"));
    res.redirect(`/submit?lang=${lang}&error=${error}`);
    return;
  }

  const answers = buildAnswersFromBody(req.body, lang);
  const imagePath = req.file ? req.file.filename : null;

  db.run(
    `
      INSERT INTO submissions (store_name, submitter_name, submitter_email, answers_json, image_path)
      VALUES (?, ?, ?, ?, ?)
    `,
    [storeName, submitterName, submitterEmail, JSON.stringify(answers), imagePath],
    (err) => {
      if (err) {
        const error = encodeURIComponent(uiText(lang, "saveError"));
        res.redirect(`/submit?lang=${lang}&error=${error}`);
        return;
      }
      const success = encodeURIComponent(uiText(lang, "saveSuccess"));
      res.redirect(`/submit?lang=${lang}&success=${success}`);
    }
  );
});

app.get("/admin/login", (req, res) => {
  res.render("admin/login", {
    title: "Admin Login",
    error: "",
  });
});

app.post("/admin/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  try {
    const row = await dbGet(
      "SELECT username, password_hash FROM admin_credentials WHERE username = ?",
      [username]
    );
    const matches = row ? await bcrypt.compare(password, row.password_hash) : false;
    if (matches) {
      req.session.isAdmin = true;
      req.session.adminUsername = row.username;
      res.redirect("/admin");
      return;
    }
    res.status(401).render("admin/login", {
      title: "Admin Login",
      error: "Invalid username or password.",
    });
  } catch (_err) {
    res.status(500).render("admin/login", {
      title: "Admin Login",
      error: "Login failed. Please try again.",
    });
  }
});

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});

app.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const rows = await dbAll(
      `
        SELECT *
        FROM submissions
        ORDER BY datetime(created_at) DESC
      `
    );
    const totalRow = await dbGet("SELECT COUNT(*) AS total_count FROM submissions");
    const lastCsvDownloadedAt = await getMetaValue("last_csv_download_at");
    const newCountRow = lastCsvDownloadedAt
      ? await dbGet(
          "SELECT COUNT(*) AS new_count FROM submissions WHERE datetime(created_at) > datetime(?)",
          [lastCsvDownloadedAt]
        )
      : await dbGet("SELECT COUNT(*) AS new_count FROM submissions");

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
      totalSubmissions: totalRow ? totalRow.total_count : 0,
      newSubmissions: newCountRow ? newCountRow.new_count : 0,
      lastCsvDownloadedAt,
    });
  } catch (_err) {
    res.status(500).send("Could not load submissions.");
  }
});

function escapeCsvValue(value) {
  const raw = String(value == null ? "" : value);
  const escaped = raw.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

app.get("/admin/submissions.csv", requireAdmin, async (_req, res) => {
  try {
    const rows = await dbAll(
      `
        SELECT *
        FROM submissions
        ORDER BY datetime(created_at) DESC
      `
    );
    const timestamp = new Date().toISOString();
    await setMetaValue("last_csv_download_at", timestamp);

    const csvRows = [
      [
        "id",
        "store_name",
        "submitter_name",
        "submitter_email",
        "created_at",
        "image_path",
        "answers",
      ].join(","),
    ];

    rows.forEach((row) => {
      let answers = [];
      try {
        answers = JSON.parse(row.answers_json);
      } catch (_e) {
        answers = [];
      }
      const answersText = answers
        .map((a) => `${a.label}: ${a.value || "-"}`)
        .join(" | ");
      csvRows.push(
        [
          row.id,
          row.store_name,
          row.submitter_name,
          row.submitter_email || "",
          row.created_at,
          row.image_path || "",
          answersText,
        ]
          .map(escapeCsvValue)
          .join(",")
      );
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="submissions-${timestamp.slice(0, 10)}.csv"`
    );
    res.send(csvRows.join("\n"));
  } catch (_err) {
    res.status(500).send("Could not export submissions.");
  }
});

app.get("/admin/settings", requireAdmin, (req, res) => {
  res.render("admin/settings", {
    title: "Admin Settings",
    adminUsername: req.session.adminUsername || ADMIN_USERNAME,
    error: "",
    success: "",
  });
});

app.post("/admin/settings/password", requireAdmin, async (req, res) => {
  const adminUsername = req.session.adminUsername || ADMIN_USERNAME;
  const currentPassword = String(req.body.current_password || "");
  const newPassword = String(req.body.new_password || "");
  const confirmPassword = String(req.body.confirm_password || "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    res.status(400).render("admin/settings", {
      title: "Admin Settings",
      adminUsername,
      error: "All password fields are required.",
      success: "",
    });
    return;
  }
  if (newPassword.length < 10) {
    res.status(400).render("admin/settings", {
      title: "Admin Settings",
      adminUsername,
      error: "New password must be at least 10 characters.",
      success: "",
    });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).render("admin/settings", {
      title: "Admin Settings",
      adminUsername,
      error: "New password and confirmation do not match.",
      success: "",
    });
    return;
  }

  try {
    const row = await dbGet(
      "SELECT password_hash FROM admin_credentials WHERE username = ?",
      [adminUsername]
    );
    const matches = row ? await bcrypt.compare(currentPassword, row.password_hash) : false;
    if (!matches) {
      res.status(401).render("admin/settings", {
        title: "Admin Settings",
        adminUsername,
        error: "Current password is incorrect.",
        success: "",
      });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 12);
    await dbRun(
      `
        UPDATE admin_credentials
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE username = ?
      `,
      [newHash, adminUsername]
    );
    res.render("admin/settings", {
      title: "Admin Settings",
      adminUsername,
      error: "",
      success: "Password updated successfully.",
    });
  } catch (_err) {
    res.status(500).render("admin/settings", {
      title: "Admin Settings",
      adminUsername,
      error: "Could not update password right now.",
      success: "",
    });
  }
});

app.use((err, _req, res, _next) => {
  if (err && err.message) {
    res.status(400).send(err.message);
    return;
  }
  res.status(500).send("Unexpected server error.");
});

ensureAdminCredential()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`CMS running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize admin credentials.", err);
    process.exit(1);
  });
