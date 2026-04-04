ALTER TABLE "documents" ADD CONSTRAINT "documents_latest_revision_id_fk"
  FOREIGN KEY ("latest_revision_id") REFERENCES "document_revisions"("id") ON DELETE SET NULL;
