-- Cleans the database
DROP TABLE IF EXISTS users;

-- Creates users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(64),
  password VARCHAR(64)
);

-- Adds administrator and one regular user
INSERT INTO users (username, password)
VALUES
  ('admin', 'admin'),
  ('pero', 'kos'),
  ('user', 'aabc');

-- Creates comments table
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment TEXT
);

-- Creates games table
CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  link TEXT
);