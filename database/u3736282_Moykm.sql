SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
CREATE TABLE `auth_attempts` (
  `bucket` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `window_start` bigint UNSIGNED NOT NULL,
  `attempts` int UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `cars` (
  `id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `name` varchar(80) NOT NULL,
  `plate` varchar(20) NOT NULL,
  `vin` varchar(17) NOT NULL,
  `year` smallint UNSIGNED DEFAULT NULL,
  `drive` enum('front','rear','awd') DEFAULT NULL,
  `specs` json DEFAULT NULL,
  `haldex` tinyint(1) NOT NULL DEFAULT '0',
  `fuel_type` varchar(20) NOT NULL,
  `initial_odometer` decimal(10,2) UNSIGNED NOT NULL,
  `tank_capacity` decimal(6,2) UNSIGNED DEFAULT NULL,
  `initial_fuel` decimal(6,2) UNSIGNED DEFAULT NULL,
  `base_consumption` decimal(5,2) UNSIGNED DEFAULT NULL,
  `service_start` date DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `car_photos` (
  `car_id` int UNSIGNED NOT NULL,
  `mime` varchar(24) NOT NULL,
  `content` mediumblob NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `entries` (
  `id` int UNSIGNED NOT NULL,
  `car_id` int UNSIGNED NOT NULL,
  `type` enum('trip','fuel','service','other','fuel_level','odometer') NOT NULL,
  `occurred_at` datetime NOT NULL,
  `note` varchar(1000) NOT NULL,
  `cost` decimal(12,2) UNSIGNED NOT NULL DEFAULT '0.00',
  `odometer` decimal(10,2) UNSIGNED DEFAULT NULL,
  `request_key` char(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `data` json NOT NULL,
  `pending` tinyint(1) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `parts` (
  `id` int UNSIGNED NOT NULL,
  `car_id` int UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `article` varchar(80) NOT NULL,
  `maker` varchar(80) NOT NULL,
  `price` decimal(12,2) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `plans` (
  `id` int UNSIGNED NOT NULL,
  `car_id` int UNSIGNED NOT NULL,
  `code` varchar(24) DEFAULT NULL,
  `name` varchar(80) NOT NULL,
  `interval_km` int UNSIGNED DEFAULT NULL,
  `interval_months` smallint UNSIGNED DEFAULT NULL,
  `planned_date` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `routes` (
  `entry_id` int UNSIGNED NOT NULL,
  `points` json NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `saved_places` (
  `id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `name` varchar(80) NOT NULL,
  `latitude` decimal(8,6) NOT NULL,
  `longitude` decimal(9,6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `sessions` (
  `token_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `device` varchar(180) NOT NULL,
  `created_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE `users` (
  `id` int UNSIGNED NOT NULL,
  `nickname` varchar(24) NOT NULL,
  `nickname_key` varchar(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `last_car_id` int UNSIGNED DEFAULT NULL,
  `theme` enum('light','dark','system') NOT NULL DEFAULT 'system',
  `accent` enum('teal','blue','violet','rose','amber','emerald','orange') NOT NULL DEFAULT 'orange',
  `neon` tinyint(1) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
ALTER TABLE `auth_attempts`
  ADD PRIMARY KEY (`bucket`),
  ADD KEY `window_start` (`window_start`);
ALTER TABLE `cars`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`,`id`);
ALTER TABLE `car_photos`
  ADD PRIMARY KEY (`car_id`);
ALTER TABLE `entries`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `car_id_2` (`car_id`,`request_key`),
  ADD KEY `car_id` (`car_id`,`occurred_at`,`id`);
ALTER TABLE `parts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `car_id` (`car_id`,`id`);
ALTER TABLE `plans`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `car_id` (`car_id`,`code`);
ALTER TABLE `routes`
  ADD PRIMARY KEY (`entry_id`);
ALTER TABLE `saved_places`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`,`id`);
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`token_hash`),
  ADD KEY `expires_at` (`expires_at`),
  ADD KEY `user_id` (`user_id`,`created_at`);
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nickname_key` (`nickname_key`);
ALTER TABLE `cars`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;
ALTER TABLE `entries`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;
ALTER TABLE `parts`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;
ALTER TABLE `plans`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;
ALTER TABLE `saved_places`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;
ALTER TABLE `users`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT;
ALTER TABLE `cars`
  ADD CONSTRAINT `cars_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
ALTER TABLE `car_photos`
  ADD CONSTRAINT `car_photos_ibfk_1` FOREIGN KEY (`car_id`) REFERENCES `cars` (`id`) ON DELETE CASCADE;
ALTER TABLE `entries`
  ADD CONSTRAINT `entries_ibfk_1` FOREIGN KEY (`car_id`) REFERENCES `cars` (`id`) ON DELETE CASCADE;
ALTER TABLE `parts`
  ADD CONSTRAINT `parts_ibfk_1` FOREIGN KEY (`car_id`) REFERENCES `cars` (`id`) ON DELETE CASCADE;
ALTER TABLE `plans`
  ADD CONSTRAINT `plans_ibfk_1` FOREIGN KEY (`car_id`) REFERENCES `cars` (`id`) ON DELETE CASCADE;
ALTER TABLE `routes`
  ADD CONSTRAINT `routes_ibfk_1` FOREIGN KEY (`entry_id`) REFERENCES `entries` (`id`) ON DELETE CASCADE;
ALTER TABLE `saved_places`
  ADD CONSTRAINT `saved_places_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
ALTER TABLE `sessions`
  ADD CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
