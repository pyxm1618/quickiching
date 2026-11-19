ALTER TABLE "accounts" ALTER COLUMN "issuer" DROP NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "accounts_issuer_account_id_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_id_idx" ON "accounts" USING btree ("provider_id","account_id");
