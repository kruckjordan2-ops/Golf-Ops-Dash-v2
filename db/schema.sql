-- Victoria Golf Ops — D1 Database Schema
-- Run: wrangler d1 execute golf-ops-db --file=db/schema.sql

-- ── Members ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  member_code TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender TEXT,
  birthday TEXT,
  age INTEGER,
  age_group TEXT,
  join_date TEXT,
  join_year INTEGER,
  tenure INTEGER,
  tenure_bucket TEXT,
  membership_type TEXT,
  handicap REAL,
  city TEXT,
  -- Equipment
  driver TEXT DEFAULT '',
  woods TEXT DEFAULT '',
  irons TEXT DEFAULT '',
  wedges TEXT DEFAULT '',
  putter TEXT DEFAULT '',
  ball TEXT DEFAULT '',
  -- Sizing
  glove_brand TEXT DEFAULT '',
  glove_size TEXT DEFAULT '',
  apparel_brand TEXT DEFAULT '',
  apparel_size TEXT DEFAULT '',
  shoe_brand TEXT DEFAULT '',
  shoe_size TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_members_name ON members(last_name, first_name);
CREATE INDEX idx_members_type ON members(membership_type);
CREATE INDEX idx_members_code ON members(member_code);

-- ── Rounds (monthly aggregates by day-of-week) ────────────
CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  am INTEGER DEFAULT 0,
  pm INTEGER DEFAULT 0,
  after_3pm INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  guests INTEGER DEFAULT 0,
  members INTEGER DEFAULT 0,
  mgr_intro INTEGER DEFAULT 0,
  interstate INTEGER DEFAULT 0,
  intl INTEGER DEFAULT 0,
  industry INTEGER DEFAULT 0,
  memb_intro INTEGER DEFAULT 0,
  memb_unaccomp INTEGER DEFAULT 0,
  corporate INTEGER DEFAULT 0,
  event INTEGER DEFAULT 0,
  non_playing INTEGER DEFAULT 0,
  voucher INTEGER DEFAULT 0,
  recip INTEGER DEFAULT 0,
  comp INTEGER DEFAULT 0,
  guest_ratio REAL DEFAULT 0,
  UNIQUE(year, month, day_of_week)
);

CREATE INDEX idx_rounds_year ON rounds(year);

-- ── Competition Rounds (per member) ────────────────────────
CREATE TABLE IF NOT EXISTS competition_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_code TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  category TEXT,
  raw_category TEXT,
  age INTEGER,
  age_bracket TEXT,
  comp_rounds INTEGER DEFAULT 0,
  social_rounds INTEGER DEFAULT 0,
  total_rounds INTEGER DEFAULT 0,
  comp_pct REAL DEFAULT 0,
  period TEXT NOT NULL,
  FOREIGN KEY (member_code) REFERENCES members(member_code)
);

CREATE INDEX idx_comp_member ON competition_rounds(member_code);
CREATE INDEX idx_comp_period ON competition_rounds(period);

-- ── Sales Transactions (per member, per year) ──────────────
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT,
  member_name TEXT NOT NULL,
  year TEXT NOT NULL,
  total REAL DEFAULT 0,
  fnb REAL DEFAULT 0,
  proshop REAL DEFAULT 0,
  golf REAL DEFAULT 0,
  other REAL DEFAULT 0,
  transactions INTEGER DEFAULT 0,
  UNIQUE(member_id, year)
);

CREATE INDEX idx_sales_member ON sales(member_id);
CREATE INDEX idx_sales_year ON sales(year);

-- ── Sales Groups (breakdown by category per member/year) ───
CREATE TABLE IF NOT EXISTS sales_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  group_name TEXT NOT NULL,
  amount REAL DEFAULT 0,
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);

-- ── Pace of Play ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pace_of_play (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  hole INTEGER NOT NULL,
  group_num INTEGER,
  start_time TEXT,
  end_time TEXT,
  duration_minutes REAL,
  players INTEGER,
  status TEXT
);

CREATE INDEX idx_pace_date ON pace_of_play(report_date);

-- ── Bookings ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_code TEXT,
  member_name TEXT,
  booking_date TEXT NOT NULL,
  time_slot TEXT,
  period TEXT,  -- AM / PM / After3
  category TEXT,
  FOREIGN KEY (member_code) REFERENCES members(member_code)
);

CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_member ON bookings(member_code);

-- ── File Uploads (tracking R2 objects) ─────────────────────
CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  file_type TEXT,       -- timesheet, rounds, sales, pace, etc.
  file_size INTEGER,
  uploaded_by TEXT,
  processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_uploads_type ON uploads(file_type);

-- ── Leaderboard ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_code TEXT NOT NULL,
  member_name TEXT NOT NULL,
  competition_name TEXT NOT NULL,
  round_date TEXT,
  score INTEGER,
  handicap REAL,
  net_score REAL,
  position INTEGER,
  season TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (member_code) REFERENCES members(member_code)
);

CREATE INDEX idx_leaderboard_comp ON leaderboard(competition_name);
CREATE INDEX idx_leaderboard_season ON leaderboard(season);
CREATE INDEX idx_leaderboard_member ON leaderboard(member_code);
