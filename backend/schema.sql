-- ============================================================
-- Sichai Pani Irrigation Management System - MySQL Schema
-- Run against MySQL 8.0+
-- (This is generated for reference / manual deployment; the
--  FastAPI app also creates these tables automatically on
--  startup via SQLAlchemy against DATABASE_URL.)
-- ============================================================

CREATE DATABASE IF NOT EXISTS sichai_pani CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sichai_pani;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    username VARCHAR(50) UNIQUE,
    mobile_number VARCHAR(20) UNIQUE,
    hashed_password VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    role ENUM('super_admin','admin','water_operator','farmer','guest') NOT NULL DEFAULT 'farmer',
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    photo_url VARCHAR(500),
    must_change_password BOOLEAN DEFAULT FALSE,
    security_question_1 VARCHAR(255),
    security_answer_1_hash VARCHAR(255),
    security_question_2 VARCHAR(255),
    security_answer_2_hash VARCHAR(255),
    security_question_3 VARCHAR(255),
    security_answer_3_hash VARCHAR(255),
    failed_login_attempts INT DEFAULT 0,
    locked_until DATETIME,
    active_session_id VARCHAR(64),
    last_login_at DATETIME,
    last_login_ip VARCHAR(64),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE login_challenges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(36) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    status ENUM('pending','allowed','rejected','expired') DEFAULT 'pending',
    requester_ip VARCHAR(64),
    requester_user_agent VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE login_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    role VARCHAR(30),
    action VARCHAR(50) NOT NULL,
    ip_address VARCHAR(64),
    user_agent VARCHAR(255),
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_loginlog_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE farmers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    farmer_code VARCHAR(30) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    father_name VARCHAR(150),
    mobile_number VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    address VARCHAR(255),
    village VARCHAR(150),
    land_area FLOAT,
    crop_type VARCHAR(100),
    photo_url VARCHAR(500),
    map_latitude FLOAT,
    map_longitude FLOAT,
    documents TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_farmer_village (village),
    INDEX idx_farmer_mobile (mobile_number)
) ENGINE=InnoDB;

CREATE TABLE canals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    location VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE pumps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    canal_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (canal_id) REFERENCES canals(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE water_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farmer_id INT NOT NULL,
    operator_id INT,
    request_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    total_hours FLOAT NOT NULL DEFAULT 0,
    crop VARCHAR(100),
    canal_id INT,
    pump_id INT,
    remarks TEXT,
    status ENUM('pending','approved','rejected','rescheduled','in_progress','completed') DEFAULT 'pending',
    rate_per_hour FLOAT NOT NULL DEFAULT 200,
    total_amount FLOAT NOT NULL DEFAULT 0,
    payment_status ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    actual_start_time DATETIME,
    actual_end_time DATETIME,
    actual_total_hours FLOAT,
    FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
    FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (canal_id) REFERENCES canals(id) ON DELETE SET NULL,
    FOREIGN KEY (pump_id) REFERENCES pumps(id) ON DELETE SET NULL,
    INDEX idx_wr_date (request_date),
    INDEX idx_wr_status (status)
) ENGINE=InnoDB;

CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    water_request_id INT NOT NULL,
    farmer_id INT NOT NULL,
    amount FLOAT NOT NULL,
    method ENUM('esewa','khalti','fonepay','bank_transfer','cash') NOT NULL,
    status ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
    transaction_id VARCHAR(150) UNIQUE,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    invoice_number VARCHAR(50) UNIQUE,
    notes TEXT,
    proof_url VARCHAR(500),
    proof_uploaded_at DATETIME,
    FOREIGN KEY (water_request_id) REFERENCES water_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
    INDEX idx_payment_status (status),
    INDEX idx_payment_farmer (farmer_id)
) ENGINE=InnoDB;

CREATE TABLE complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farmer_id INT NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    photo_url VARCHAR(500),
    status ENUM('open','in_progress','resolved','closed') DEFAULT 'open',
    admin_reply TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(100) UNIQUE NOT NULL,
    value TEXT
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
