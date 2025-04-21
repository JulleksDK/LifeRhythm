-- Database oprettelse
CREATE DATABASE liferhythm_db;
USE liferhythm_db;

-- Brugertabel
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

-- Aktivitetstyper
CREATE TABLE activity_types (
    activity_type_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#4CAF50',
    icon VARCHAR(50)
);

-- Ugeplaner
CREATE TABLE weekly_schedules (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    week_number INT NOT NULL,
    year INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE (user_id, week_number, year)
);

-- Aktiviteter i ugeplanen
CREATE TABLE schedule_activities (
    activity_id INT AUTO_INCREMENT PRIMARY KEY,
    schedule_id INT NOT NULL,
    activity_type_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    day_of_week TINYINT NOT NULL, -- 1=Mandag, 7=Søndag
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    priority TINYINT DEFAULT 3, -- 1=Høj, 3=Normal, 5=Lav
    FOREIGN KEY (schedule_id) REFERENCES weekly_schedules(schedule_id) ON DELETE CASCADE,
    FOREIGN KEY (activity_type_id) REFERENCES activity_types(activity_type_id)
);

-- Evaluering af aktiviteter
CREATE TABLE activity_evaluations (
    evaluation_id INT AUTO_INCREMENT PRIMARY KEY,
    activity_id INT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    satisfaction_rating TINYINT, -- 1-5 skala
    notes TEXT,
    evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (activity_id) REFERENCES schedule_activities(activity_id) ON DELETE CASCADE
);

-- AI-forslag og feedback
CREATE TABLE ai_suggestions (
    suggestion_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    suggestion_type VARCHAR(50) NOT NULL, -- f.eks. 'activity_improvement', 'schedule_balance'
    suggestion_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Brugerindstillinger
CREATE TABLE user_preferences (
    user_id INT PRIMARY KEY,
    wake_up_time TIME DEFAULT '07:00:00',
    bedtime TIME DEFAULT '23:00:00',
    work_hours_per_day INT DEFAULT 8,
    work_days VARCHAR(20) DEFAULT '1,2,3,4,5', -- Dage i ugen brugeren arbejder
    free_time_priority TINYINT DEFAULT 3, -- 1-5 skala
    family_time_priority TINYINT DEFAULT 3, -- 1-5 skala
    exercise_priority TINYINT DEFAULT 3, -- 1-5 skala
    theme VARCHAR(20) DEFAULT 'light',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Standard aktivitetstyper
INSERT INTO activity_types (name, color, icon) VALUES 
('Arbejde', '#2196F3', 'briefcase'),
('Søvn', '#9C27B0', 'bed'),
('Motion', '#FF9800', 'dumbbell'),
('Familie', '#F44336', 'heart'),
('Fritid', '#4CAF50', 'hobby'),
('Måltider', '#795548', 'utensils'),
('Transport', '#607D8B', 'car'),
('Afslapning', '#00BCD4', 'couch');