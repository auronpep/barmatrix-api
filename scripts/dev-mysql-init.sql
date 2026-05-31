-- Runs once on first container init (docker-entrypoint-initdb.d).
-- Creates the test database + user the DB-backed test suite expects:
-- src/*.test.ts hardcode DATABASE_HOST=127.0.0.1, DATABASE_NAME=test_db,
-- DATABASE_USER=test_user, DATABASE_PASSWORD=test_password.
CREATE DATABASE IF NOT EXISTS test_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'test_user'@'%' IDENTIFIED BY 'test_password';
GRANT ALL PRIVILEGES ON test_db.* TO 'test_user'@'%';
-- Same user can also read/write the dev app DB (MYSQL_DATABASE=barmatrix).
GRANT ALL PRIVILEGES ON barmatrix.* TO 'test_user'@'%';
FLUSH PRIVILEGES;
