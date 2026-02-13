-- IRP CAD add-on tables (safe to apply alongside ps-mdt)
CREATE TABLE IF NOT EXISTS `irp_cad_users` (
  `discord_id` VARCHAR(32) NOT NULL,
  `discord_name` VARCHAR(128) DEFAULT NULL,
  `avatar` VARCHAR(255) DEFAULT NULL,
  `disabled` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`discord_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `irp_cad_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `discord_id` VARCHAR(32) NOT NULL,
  `perm_key` VARCHAR(64) NOT NULL,
  `value` TINYINT(1) NOT NULL DEFAULT 1,
  `granted_by_discord_id` VARCHAR(32) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_user_perm` (`discord_id`, `perm_key`),
  KEY `idx_perm_user` (`discord_id`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `irp_cad_audit` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `discord_id` VARCHAR(32) NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `target` VARCHAR(128) DEFAULT NULL,
  `meta` JSON DEFAULT NULL,
  `ip` VARCHAR(64) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_audit_user_time` (`discord_id`, `created_at`),
  KEY `idx_audit_action_time` (`action`, `created_at`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
