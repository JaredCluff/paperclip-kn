ALTER TABLE "agent_api_keys" DROP CONSTRAINT IF EXISTS "agent_api_keys_key_hash_idx";
DROP INDEX IF EXISTS "agent_api_keys_key_hash_idx";
CREATE UNIQUE INDEX "agent_api_keys_key_hash_unique_idx" ON "agent_api_keys" USING btree ("key_hash");
