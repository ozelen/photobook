-- Fix default user password hash (bcryptjs-compatible)
UPDATE users
SET password_hash = '$2b$10$2CJ6e6t5KUG0yQfaDEizi.J5cn0IpP8mcZEFpFfU4XCEvkqmHUZsa'
WHERE email = 'ozelen@example.com';
