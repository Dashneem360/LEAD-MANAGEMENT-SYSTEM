SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS meeting_participants;
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS webinar_attendees;
DROP TABLE IF EXISTS webinars;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS followups;
DROP TABLE IF EXISTS lead_tags;
DROP TABLE IF EXISTS lead_remarks;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS user_stats;
DROP TABLE IF EXISTS user_earnings;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(40) DEFAULT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  avatar VARCHAR(255) DEFAULT '',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_active (role, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_earnings (
  user_id BIGINT UNSIGNED NOT NULL,
  total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  this_month DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  this_week DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_earnings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_stats (
  user_id BIGINT UNSIGNED NOT NULL,
  total_leads INT NOT NULL DEFAULT 0,
  converted_leads INT NOT NULL DEFAULT 0,
  total_followups INT NOT NULL DEFAULT 0,
  completed_followups INT NOT NULL DEFAULT 0,
  missed_followups INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_stats_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE leads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  alternate_phone VARCHAR(40) DEFAULT NULL,
  email VARCHAR(190) DEFAULT NULL,
  city VARCHAR(120) DEFAULT NULL,
  state VARCHAR(120) DEFAULT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'manual',
  status VARCHAR(40) NOT NULL DEFAULT 'new',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  assigned_to_user_id BIGINT UNSIGNED DEFAULT NULL,
  assigned_by_user_id BIGINT UNSIGNED DEFAULT NULL,
  assigned_at DATETIME DEFAULT NULL,
  webinar_status VARCHAR(40) NOT NULL DEFAULT 'not_invited',
  webinar_seen_at DATETIME DEFAULT NULL,
  webinar_link VARCHAR(255) DEFAULT NULL,
  call_count INT NOT NULL DEFAULT 0,
  last_called_at DATETIME DEFAULT NULL,
  call_duration INT NOT NULL DEFAULT 0,
  next_followup_date DATETIME DEFAULT NULL,
  last_followup_date DATETIME DEFAULT NULL,
  followup_count INT NOT NULL DEFAULT 0,
  latest_remark TEXT DEFAULT NULL,
  deal_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  commission DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  sheet_row_index INT DEFAULT NULL,
  sheet_id VARCHAR(190) DEFAULT NULL,
  last_synced_at DATETIME DEFAULT NULL,
  product VARCHAR(190) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leads_phone (phone),
  KEY idx_leads_assigned (assigned_to_user_id),
  KEY idx_leads_status (status),
  KEY idx_leads_followup (next_followup_date),
  KEY idx_leads_created (created_at),
  KEY idx_leads_webinar_status (webinar_status),
  CONSTRAINT fk_leads_assigned_to FOREIGN KEY (assigned_to_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_assigned_by FOREIGN KEY (assigned_by_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lead_remarks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id BIGINT UNSIGNED NOT NULL,
  added_by_user_id BIGINT UNSIGNED DEFAULT NULL,
  text TEXT NOT NULL,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lead_remarks_lead (lead_id, added_at),
  CONSTRAINT fk_lead_remarks_lead FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE CASCADE,
  CONSTRAINT fk_lead_remarks_user FOREIGN KEY (added_by_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lead_tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id BIGINT UNSIGNED NOT NULL,
  tag VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lead_tag (lead_id, tag),
  CONSTRAINT fk_lead_tags_lead FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE followups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id BIGINT UNSIGNED NOT NULL,
  assigned_to_user_id BIGINT UNSIGNED NOT NULL,
  assigned_by_user_id BIGINT UNSIGNED DEFAULT NULL,
  scheduled_date DATETIME NOT NULL,
  scheduled_time VARCHAR(20) DEFAULT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  type VARCHAR(30) NOT NULL DEFAULT 'call',
  meeting_link VARCHAR(255) DEFAULT NULL,
  outcome VARCHAR(40) DEFAULT NULL,
  remark TEXT DEFAULT NULL,
  duration INT NOT NULL DEFAULT 0,
  completed_at DATETIME DEFAULT NULL,
  completed_by_user_id BIGINT UNSIGNED DEFAULT NULL,
  rescheduled_to DATETIME DEFAULT NULL,
  rescheduled_reason TEXT DEFAULT NULL,
  alert_sent TINYINT(1) NOT NULL DEFAULT 0,
  missed_alert_sent TINYINT(1) NOT NULL DEFAULT 0,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_followups_assigned_date (assigned_to_user_id, scheduled_date),
  KEY idx_followups_lead (lead_id),
  KEY idx_followups_status (status),
  KEY idx_followups_completed (completed_at),
  CONSTRAINT fk_followups_lead FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE CASCADE,
  CONSTRAINT fk_followups_assigned_to FOREIGN KEY (assigned_to_user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_followups_assigned_by FOREIGN KEY (assigned_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_followups_completed_by FOREIGN KEY (completed_by_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(190) NOT NULL,
  message TEXT NOT NULL,
  related_lead_id BIGINT UNSIGNED DEFAULT NULL,
  related_followup_id BIGINT UNSIGNED DEFAULT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_read (user_id, is_read, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_lead FOREIGN KEY (related_lead_id) REFERENCES leads (id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_followup FOREIGN KEY (related_followup_id) REFERENCES followups (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE webinars (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(190) NOT NULL,
  description TEXT DEFAULT NULL,
  scheduled_at DATETIME NOT NULL,
  duration INT NOT NULL DEFAULT 60,
  link VARCHAR(255) DEFAULT NULL,
  youtube_link VARCHAR(255) DEFAULT NULL,
  zoom_link VARCHAR(255) DEFAULT NULL,
  platform VARCHAR(40) NOT NULL DEFAULT 'zoom',
  status VARCHAR(40) NOT NULL DEFAULT 'upcoming',
  created_by_user_id BIGINT UNSIGNED DEFAULT NULL,
  total_invited INT NOT NULL DEFAULT 0,
  total_attended INT NOT NULL DEFAULT 0,
  notes TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_webinars_scheduled (scheduled_at),
  CONSTRAINT fk_webinars_created_by FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE webinar_attendees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  webinar_id BIGINT UNSIGNED NOT NULL,
  lead_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'invited',
  marked_by_user_id BIGINT UNSIGNED DEFAULT NULL,
  marked_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_webinar_attendee (webinar_id, lead_id),
  KEY idx_webinar_attendees_status (status),
  CONSTRAINT fk_webinar_attendees_webinar FOREIGN KEY (webinar_id) REFERENCES webinars (id) ON DELETE CASCADE,
  CONSTRAINT fk_webinar_attendees_lead FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE CASCADE,
  CONSTRAINT fk_webinar_attendees_marked_by FOREIGN KEY (marked_by_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_user_id BIGINT UNSIGNED NOT NULL,
  to_user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'text',
  content TEXT DEFAULT NULL,
  audio_url VARCHAR(255) DEFAULT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  whatsapp_sent TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_conversation (from_user_id, to_user_id, created_at),
  KEY idx_messages_unread (to_user_id, is_read),
  CONSTRAINT fk_messages_from_user FOREIGN KEY (from_user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_to_user FOREIGN KEY (to_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE meetings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(190) NOT NULL,
  scheduled_at DATETIME NOT NULL,
  duration INT NOT NULL DEFAULT 30,
  meeting_link VARCHAR(255) DEFAULT NULL,
  platform VARCHAR(40) NOT NULL DEFAULT 'zoom',
  organizer_user_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  notes TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_meetings_organizer (organizer_user_id, scheduled_at),
  CONSTRAINT fk_meetings_organizer FOREIGN KEY (organizer_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE meeting_participants (
  meeting_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (meeting_id, user_id),
  KEY idx_meeting_participants_user (user_id),
  CONSTRAINT fk_meeting_participants_meeting FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE,
  CONSTRAINT fk_meeting_participants_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (id, name, email, password_hash, phone, role, avatar, is_active, created_at, updated_at)
VALUES
  (1, 'Admin User', 'admin@leadcrm.local', '$2a$10$i8oY5PFbW8x.SYfaDFh2dOf08gn7F0khklUNd7TAC5tSm0rAX5Tgi', '9999999999', 'admin', '', 1, NOW(), NOW());

INSERT INTO user_earnings (user_id, total, this_month, this_week)
VALUES
  (1, 0.00, 0.00, 0.00);

INSERT INTO user_stats (user_id, total_leads, converted_leads, total_followups, completed_followups, missed_followups)
VALUES
  (1, 0, 0, 0, 0, 0);

SET FOREIGN_KEY_CHECKS = 1;
