-- ============================================
-- Time Management and Pomodoro Tracker
-- Database Setup Script - AwardSpace Compatible
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;

-- Table 1: user
CREATE TABLE IF NOT EXISTS `user` (
    `userID`       INT AUTO_INCREMENT PRIMARY KEY,
    `name`         VARCHAR(100)  NOT NULL,
    `email`        VARCHAR(150)  NOT NULL UNIQUE,
    `passwordHash` VARCHAR(255)  NOT NULL,
    `avatarColor`  VARCHAR(7)    NULL DEFAULT NULL,
    `createdAt`    DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 1b: otp_tokens (keep for future use)
CREATE TABLE IF NOT EXISTS `otp_tokens` (
    `id`        INT AUTO_INCREMENT PRIMARY KEY,
    `email`     VARCHAR(150) NOT NULL,
    `token`     VARCHAR(6)   NOT NULL,
    `type`      ENUM('verify_email', 'reset_password') NOT NULL,
    `expiresAt` DATETIME NOT NULL,
    `usedAt`    DATETIME NULL,
    INDEX `idx_email_type` (`email`, `type`),
    INDEX `idx_token`      (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 2: task
CREATE TABLE IF NOT EXISTS `task` (
    `taskID`      INT AUTO_INCREMENT PRIMARY KEY,
    `userID`      INT  NOT NULL,
    `title`       VARCHAR(200) NOT NULL,
    `description` TEXT,
    `priority`    ENUM('high', 'medium', 'low') DEFAULT 'medium',
    `deadline`    DATE NULL,
    `status`      ENUM('pending', 'completed') DEFAULT 'pending',
    `createdAt`   DATETIME DEFAULT CURRENT_TIMESTAMP,
    `completedAt` DATETIME NULL,
    FOREIGN KEY (`userID`) REFERENCES `user`(`userID`) ON DELETE CASCADE,
    INDEX `idx_user_status`   (`userID`, `status`),
    INDEX `idx_user_priority` (`userID`, `priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3: pomodorosession
CREATE TABLE IF NOT EXISTS `pomodorosession` (
    `sessionID` INT AUTO_INCREMENT PRIMARY KEY,
    `taskID`    INT NULL,
    `userID`    INT NOT NULL,
    `duration`  INT NOT NULL DEFAULT 25,
    `startTime` DATETIME NOT NULL,
    `endTime`   DATETIME NOT NULL,
    `type`      ENUM('work', 'shortBreak', 'longBreak') DEFAULT 'work',
    FOREIGN KEY (`taskID`) REFERENCES `task`(`taskID`) ON DELETE SET NULL,
    FOREIGN KEY (`userID`) REFERENCES `user`(`userID`) ON DELETE CASCADE,
    INDEX `idx_user_date` (`userID`, `startTime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 4: timer
CREATE TABLE IF NOT EXISTS `timer` (
    `timerID`       INT AUTO_INCREMENT PRIMARY KEY,
    `userID`        INT NOT NULL,
    `duration`      INT NOT NULL DEFAULT 25,
    `remainingTime` INT NOT NULL,
    `isRunning`     BOOLEAN DEFAULT FALSE,
    `lastUpdated`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`userID`) REFERENCES `user`(`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 5: progressrecord
CREATE TABLE IF NOT EXISTS `progressrecord` (
    `recordID`     INT AUTO_INCREMENT PRIMARY KEY,
    `sessionID`    INT NOT NULL,
    `userID`       INT NOT NULL,
    `date`         DATE NOT NULL,
    `totalMinutes` INT NOT NULL DEFAULT 0,
    FOREIGN KEY (`sessionID`) REFERENCES `pomodorosession`(`sessionID`) ON DELETE CASCADE,
    FOREIGN KEY (`userID`)    REFERENCES `user`(`userID`) ON DELETE CASCADE,
    INDEX `idx_user_date` (`userID`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 6: report
CREATE TABLE IF NOT EXISTS `report` (
    `reportID`          INT AUTO_INCREMENT PRIMARY KEY,
    `userID`            INT NOT NULL,
    `dateGenerated`     DATETIME DEFAULT CURRENT_TIMESTAMP,
    `totalSessions`     INT NOT NULL DEFAULT 0,
    `totalMinutes`      INT NOT NULL DEFAULT 0,
    `reportPeriodStart` DATE NOT NULL,
    `reportPeriodEnd`   DATE NOT NULL,
    FOREIGN KEY (`userID`) REFERENCES `user`(`userID`) ON DELETE CASCADE,
    INDEX `idx_user_period` (`userID`, `reportPeriodStart`, `reportPeriodEnd`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;