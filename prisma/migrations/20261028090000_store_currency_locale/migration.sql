-- Per-store display currency and locale. Defaults keep every existing store on NGN / en-NG behaviour.
ALTER TABLE "Store" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN';
ALTER TABLE "Store" ADD COLUMN "locale" TEXT;
