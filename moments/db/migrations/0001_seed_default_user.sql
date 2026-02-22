-- Seed default admin user: ozelen / Abcd1234
-- Email: ozelen@example.com, role: admin
INSERT INTO users (id, role, email, first_name, password_hash, created_at)
VALUES (
  '01JBG0000000000000000000001',
  'admin',
  'ozelen@example.com',
  'ozelen',
  '$2b$10$2CJ6e6t5KUG0yQfaDEizi.J5cn0IpP8mcZEFpFfU4XCEvkqmHUZsa',
  datetime('now')
);
