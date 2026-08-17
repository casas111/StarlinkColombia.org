CREATE TABLE `allocation_overrides` (
	`source_row` integer PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`edited_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
UPDATE `allocations` SET
	`institution` = 'Cruz Roja — Quibdó', `type` = 'Red Cross',
	`kit` = 'KIT408420873B7X
KIT408420867M95
KIT408420857WQG
KIT408420891BDM',
	`city` = 'Quibdó', `units` = 4, `terminal` = 'In transit', `logistics` = 'Covered', `activated` = 'Waiting',
	`agreement` = 'Tigresas', `contact` = 'Claudia Janeth Pachón Chavarro — receptora Cruz Roja', `terminal_provider` = 'SpaceX/Starlink',
	`final_destination` = 'En tránsito por Flota Occidental, contacto logístico Santiago Gómez. Recepción en Terminal de Transporte de Quibdó. Uso: 2 unidades en centros de la Cruz Roja y 2 unidades móviles en automóviles.',
	`received_name` = 'Claudia Janeth Pachón Chavarro', `received_id` = '52964434', `received_phone` = '+57 319 251 5314',
	`stage` = 'delivery', `source_updated_at` = CURRENT_TIMESTAMP
WHERE `source_row` = 86;
--> statement-breakpoint
INSERT INTO `allocations` (`source_row`,`institution`,`type`,`kit`,`city`,`units`,`terminal`,`logistics`,`activated`,`agreement`,`contact`,`terminal_provider`,`final_destination`,`received_name`,`received_id`,`received_phone`,`stage`,`source_updated_at`)
VALUES (135,'SOS Chocó','NGO Collective','KIT4084208598V2
KIT4084208535RQ
KIT408420872DWP
KIT408420848PCM
KIT408420861PPB
KIT40842086242N','Quibdó',6,'In transit','Covered','Waiting','Tigresas','Juan Camilo Castro — responsable y receptor SOS Chocó','SpaceX/Starlink','En tránsito por Flota Occidental, contacto logístico Santiago Gómez. Recepción en Terminal de Transporte de Quibdó. Uso: conectividad para el colectivo SOS Chocó, integrado por múltiples fundaciones que trabajan en Quibdó.','Juan Camilo Castro','1020748431','+57 310 323 3809','delivery',CURRENT_TIMESTAMP)
ON CONFLICT(`source_row`) DO UPDATE SET `institution`=excluded.`institution`,`type`=excluded.`type`,`kit`=excluded.`kit`,`city`=excluded.`city`,`units`=excluded.`units`,`terminal`=excluded.`terminal`,`logistics`=excluded.`logistics`,`activated`=excluded.`activated`,`agreement`=excluded.`agreement`,`contact`=excluded.`contact`,`terminal_provider`=excluded.`terminal_provider`,`final_destination`=excluded.`final_destination`,`received_name`=excluded.`received_name`,`received_id`=excluded.`received_id`,`received_phone`=excluded.`received_phone`,`stage`=excluded.`stage`,`source_updated_at`=excluded.`source_updated_at`;
--> statement-breakpoint
INSERT INTO `allocations` (`source_row`,`institution`,`type`,`kit`,`city`,`units`,`terminal`,`logistics`,`activated`,`agreement`,`contact`,`terminal_provider`,`final_destination`,`received_name`,`received_id`,`received_phone`,`stage`,`source_updated_at`)
VALUES (136,'Brigadas médicas — Daniel Madero','Medical Brigades','KIT408420881DQ4
KIT408420877R86
KIT408420886BCW
KIT408420874RXP
KIT408420885PMQ','Quibdó',5,'In transit','Covered','Waiting','Tigresas','Daniel Madero — responsable operativo; Claudia Janeth Pachón Chavarro — receptora','SpaceX/Starlink','En tránsito por Flota Occidental, contacto logístico Santiago Gómez. Recepción en Terminal de Transporte de Quibdó. Uso: 1 centro de control de brigadas médicas, 3 brigadas terrestres y 1 brigada marítima.','Claudia Janeth Pachón Chavarro','52964434','+57 319 251 5314','delivery',CURRENT_TIMESTAMP)
ON CONFLICT(`source_row`) DO UPDATE SET `institution`=excluded.`institution`,`type`=excluded.`type`,`kit`=excluded.`kit`,`city`=excluded.`city`,`units`=excluded.`units`,`terminal`=excluded.`terminal`,`logistics`=excluded.`logistics`,`activated`=excluded.`activated`,`agreement`=excluded.`agreement`,`contact`=excluded.`contact`,`terminal_provider`=excluded.`terminal_provider`,`final_destination`=excluded.`final_destination`,`received_name`=excluded.`received_name`,`received_id`=excluded.`received_id`,`received_phone`=excluded.`received_phone`,`stage`=excluded.`stage`,`source_updated_at`=excluded.`source_updated_at`;
