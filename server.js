const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "change-me-before-going-live";
const db = new Database(path.join(__dirname, "lostfound.db"));
db.exec(`
 CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL CHECK(type IN ('lost','found')), name TEXT NOT NULL, cat TEXT NOT NULL, date TEXT NOT NULL, loc TEXT NOT NULL, details TEXT DEFAULT '', contact TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','claimed')), created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!userCols.includes("avatar")) db.exec("ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT ''");
if (!userCols.includes("theme")) db.exec("ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'default'");
if (!db.prepare("SELECT 1 FROM users LIMIT 1").get()) {
    db.prepare("INSERT INTO users (username,name,password_hash) VALUES (?,?,?)").run("admin", "Admin", bcrypt.hashSync("admin123", 10));
    console.log("Created default user admin / admin123. Change this password!");
}
const ITEM_COLS = 'id, type, name, cat, date, loc, details AS "desc", contact, status';
const app = express();
app.use(express.json({ limit: "300kb" }));
const clean = v => String(v || "").trim();
const sign = u => jwt.sign({ id: u.id, username: u.username, name: u.name }, SECRET, { expiresIn: "7d" });

function auth(req, res, next) {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch { res.status(401).json({ error: "Please sign in again." }); }
}
app.post("/api/register", (req, res) => {
    const username = clean(req.body.username).toLowerCase(),
        name = clean(req.body.name),
        pw = clean(req.body.password);
    if (!name) return res.status(400).json({ error: "Enter your full name." });
    if (!/^[a-z0-9_]{3,}$/.test(username)) return res.status(400).json({ error: "Username needs 3 or more letters, numbers or underscores." });
    if (pw.length < 6) return res.status(400).json({ error: "Password needs at least 6 characters." });
    if (db.prepare("SELECT 1 FROM users WHERE username=?").get(username)) return res.status(409).json({ error: "That username is taken." });
    const info = db.prepare("INSERT INTO users (username,name,password_hash) VALUES (?,?,?)").run(username, name, bcrypt.hashSync(pw, 10));
    const user = { id: info.lastInsertRowid, username, name };
    res.status(201).json({ token: sign(user), user: { username, name } });
});
app.post("/api/login", (req, res) => {
    const username = clean(req.body.username).toLowerCase(),
        pw = clean(req.body.password),
        u = db.prepare("SELECT * FROM users WHERE username=?").get(username);
    if (!u || !bcrypt.compareSync(pw, u.password_hash)) return res.status(401).json({ error: "Wrong username or password." });
    res.json({ token: sign(u), user: { username: u.username, name: u.name } });
});
// Demo-friendly password reset: verifies username + full name. For production, use email/OTP verification.
app.post("/api/reset-password", (req, res) => {
    const username = clean(req.body.username).toLowerCase(),
        name = clean(req.body.name),
        pw = clean(req.body.password);
    if (!username || !name || !pw) return res.status(400).json({ error: "Enter your username, full name, and new password." });
    if (pw.length < 6) return res.status(400).json({ error: "New password needs at least 6 characters." });
    const user = db.prepare("SELECT id,name FROM users WHERE username=?").get(username);
    if (!user || user.name.trim().toLowerCase() !== name.toLowerCase()) return res.status(400).json({ error: "We couldn't match that username and full name." });
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(bcrypt.hashSync(pw, 10), user.id);
    res.json({ ok: true, message: "Password reset successfully. You can now sign in with your new password." });
});
// ---- Profile: display name, profile picture and theme, saved to the account ----
const THEMES = ["default", "light", "dark"];
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const profileOf = id => db.prepare("SELECT username,name,avatar,theme FROM users WHERE id=?").get(id);
app.get("/api/profile", auth, (req, res) => {
    const p = profileOf(req.user.id);
    if (!p) return res.status(401).json({ error: "Please sign in again." });
    res.json(p);
});
app.patch("/api/profile", auth, (req, res) => {
    const b = req.body || {},
        sets = [],
        vals = [];
    if ("name" in b) {
        const name = clean(b.name);
        if (!name || name.length > 40) return res.status(400).json({ error: "Display name needs 1 to 40 characters." });
        sets.push("name=?");
        vals.push(name);
    }
    if ("avatar" in b) {
        const a = clean(b.avatar);
        if (a && (a.length > 200000 || !AVATAR_RE.test(a))) return res.status(400).json({ error: "Choose a JPG, PNG or WebP image." });
        sets.push("avatar=?");
        vals.push(a);
    }
    if ("theme" in b) {
        const t = clean(b.theme);
        if (!THEMES.includes(t)) return res.status(400).json({ error: "Theme must be default, light or dark." });
        sets.push("theme=?");
        vals.push(t);
    }
    if (!sets.length) return res.status(400).json({ error: "Nothing to update." });
    const info = db.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`).run(...vals, req.user.id);
    if (!info.changes) return res.status(401).json({ error: "Please sign in again." });
    res.json(profileOf(req.user.id));
});
app.get("/api/items", auth, (req, res) => res.json(db.prepare(`SELECT ${ITEM_COLS} FROM items ORDER BY date DESC,id DESC`).all()));
app.post("/api/items", auth, (req, res) => {
    const b = req.body,
        type = clean(b.type),
        name = clean(b.name),
        cat = clean(b.cat),
        date = clean(b.date),
        loc = clean(b.loc),
        contact = clean(b.contact);
    if (!["lost", "found"].includes(type)) return res.status(400).json({ error: "Type must be lost or found." });
    if (!name || !cat || !date || !loc || !contact) return res.status(400).json({ error: "Please fill in all required fields." });
    const info = db.prepare("INSERT INTO items (type,name,cat,date,loc,details,contact,created_by) VALUES (?,?,?,?,?,?,?,?)").run(type, name, cat, date, loc, clean(b.desc), contact, req.user.id);
    res.status(201).json(db.prepare(`SELECT ${ITEM_COLS} FROM items WHERE id=?`).get(info.lastInsertRowid));
});
app.patch("/api/items/:id", auth, (req, res) => {
    const status = clean(req.body.status);
    if (!["open", "claimed"].includes(status)) return res.status(400).json({ error: "Status must be open or claimed." });
    const info = db.prepare("UPDATE items SET status=? WHERE id=?").run(status, req.params.id);
    if (!info.changes) return res.status(404).json({ error: "Item not found." });
    res.json(db.prepare(`SELECT ${ITEM_COLS} FROM items WHERE id=?`).get(req.params.id));
});
app.delete("/api/items/:id", auth, (req, res) => {
    const info = db.prepare("DELETE FROM items WHERE id=?").run(req.params.id);
    if (!info.changes) return res.status(404).json({ error: "Item not found." });
    res.json({ ok: true });
});
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
app.use((err, req, res, next) => res.status(400).json({ error: "Bad request." }));
app.listen(PORT, () => console.log(`Open http://localhost:${PORT}`));