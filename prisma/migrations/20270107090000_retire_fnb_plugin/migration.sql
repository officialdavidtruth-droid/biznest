-- BizNest FnB is retired: POS, tables and orders live on the main dashboard; the back of house is Kitchen Management.
UPDATE "Plugin" SET "status" = 'DISABLED' WHERE "key" = 'fnb-operations';
