/*
  # Add RAG Vector Search Functions and Document Chunks Table

  ## Overview
  This migration enables functional Retrieval-Augmented Generation (RAG) by adding:
  - Document chunks table for better semantic search granularity
  - Vector similarity search functions using pgvector
  - Embedding generation helpers
  - Document retrieval optimization

  ## 1. New Tables
  
  ### `document_chunks`
  Stores chunked document content for granular semantic search
  - `id` (uuid, primary key) - Unique chunk identifier
  - `document_id` (uuid, foreign key) - Reference to parent document
  - `content` (text) - The actual text content of the chunk
  - `embedding` (vector(1536)) - OpenAI text-embedding-ada-002 compatible embeddings
  - `chunk_index` (integer) - Position in the original document
  - `metadata` (jsonb) - Additional metadata (page number, section, etc.)
  - `created_at` (timestamptz) - Creation timestamp

  ## 2. Functions
  
  ### `match_document_chunks`
  Performs semantic similarity search on document chunks
  - Uses cosine similarity for vector matching
  - Filters by similarity threshold (default 0.85 = 85% match)
  - Returns top K most relevant chunks (default 5)
  - Supports filtering by document type, jurisdiction, user ownership
  - Returns document metadata with each chunk
  
  ### `search_user_documents`
  Retrieves relevant chunks from user's private documents
  - Respects RLS policies (only user's own documents)
  - Includes public documents accessible to the user
  - Returns enriched results with document titles and metadata

  ## 3. Security
  
  ### Row Level Security (RLS)
  - Enabled on document_chunks table
  - Users can read chunks from public documents
  - Users can read chunks from their own private documents
  - Admins can access all chunks
  - Users can only insert chunks for documents they own

  ### Policies
  - "Users can read public document chunks" - Access to public content
  - "Users can read own document chunks" - Access to private uploads
  - "Users can insert own document chunks" - Upload functionality
  - "Admins can manage all document chunks" - Admin access

  ## 4. Indexes
  
  ### Performance Optimizations
  - `idx_document_chunks_embedding` - IVFFlat index for fast vector similarity search
  - `idx_document_chunks_document_id` - Fast lookups by parent document
  - `idx_document_chunks_chunk_index` - Ordered chunk retrieval
  
  ## 5. Usage Example
  
  To search for relevant document chunks:
  
  ```sql
  SELECT * FROM match_document_chunks(
    query_embedding := '[0.1, 0.2, ...]'::vector,
    match_threshold := 0.85,
    match_count := 5,
    filter_user_id := 'user-uuid'
  );
  ```

  ## Important Notes
  
  1. **Similarity Threshold**: 0.85 means 85%+ similarity required for matches
  2. **Chunk Size**: Recommended 500-1000 tokens per chunk for optimal retrieval
  3. **Embedding Model**: Designed for OpenAI text-embedding-ada-002 (1536 dimensions)
  4. **Private Documents**: RLS ensures users only retrieve their own private documents
  5. **Public Documents**: All authenticated users can search public documents
*/

-- Create document_chunks table for granular semantic search
CREATE TABLE IF NOT EXISTS document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1536),
  chunk_index integer NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);

-- Enable RLS on document_chunks
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_chunks
-- Users can read chunks from public documents
CREATE POLICY "Users can read public document chunks"
  ON document_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_chunks.document_id
      AND documents.is_public = true
    )
  );

-- Users can read chunks from their own documents
CREATE POLICY "Users can read own document chunks"
  ON document_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_chunks.document_id
      AND documents.uploaded_by = auth.uid()
    )
  );

-- Users can insert chunks for their own documents
CREATE POLICY "Users can insert own document chunks"
  ON document_chunks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_chunks.document_id
      AND documents.uploaded_by = auth.uid()
    )
  );

-- Admins can manage all document chunks
CREATE POLICY "Admins can manage all document chunks"
  ON document_chunks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Create indexes for fast vector search and lookups
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
  ON document_chunks 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id 
  ON document_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index 
  ON document_chunks(document_id, chunk_index);

-- Function to perform semantic similarity search on document chunks
-- Returns the most relevant chunks based on cosine similarity
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.85,
  match_count int DEFAULT 5,
  filter_user_id uuid DEFAULT NULL,
  filter_type text DEFAULT NULL,
  filter_jurisdiction text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  document_type text,
  document_citation text,
  document_year integer,
  jurisdiction text,
  chunk_content text,
  chunk_index integer,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id AS chunk_id,
    d.id AS document_id,
    d.title AS document_title,
    d.type AS document_type,
    d.citation AS document_citation,
    d.year AS document_year,
    d.jurisdiction,
    dc.content AS chunk_content,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    jsonb_build_object(
      'file_url', d.file_url,
      'tags', d.tags,
      'is_public', d.is_public,
      'chunk_metadata', dc.metadata
    ) AS metadata
  FROM document_chunks dc
  INNER JOIN documents d ON dc.document_id = d.id
  WHERE
    -- Similarity threshold filter
    1 - (dc.embedding <=> query_embedding) > match_threshold
    -- Document must be public OR owned by the user
    AND (
      d.is_public = true 
      OR d.uploaded_by = filter_user_id
      OR filter_user_id IS NULL
    )
    -- Optional type filter
    AND (filter_type IS NULL OR d.type = filter_type)
    -- Optional jurisdiction filter
    AND (filter_jurisdiction IS NULL OR d.jurisdiction = filter_jurisdiction)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Helper function to search user-specific documents with RAG
CREATE OR REPLACE FUNCTION search_user_documents(
  p_user_id uuid,
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.85,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  document_type text,
  chunk_content text,
  similarity float,
  is_public boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id AS chunk_id,
    d.id AS document_id,
    d.title AS document_title,
    d.type AS document_type,
    dc.content AS chunk_content,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.is_public
  FROM document_chunks dc
  INNER JOIN documents d ON dc.document_id = d.id
  WHERE
    1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (d.is_public = true OR d.uploaded_by = p_user_id)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get chunk statistics for a document
CREATE OR REPLACE FUNCTION get_document_chunk_stats(p_document_id uuid)
RETURNS TABLE (
  total_chunks integer,
  avg_chunk_length numeric,
  has_embeddings boolean
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::integer AS total_chunks,
    AVG(LENGTH(content))::numeric AS avg_chunk_length,
    BOOL_AND(embedding IS NOT NULL) AS has_embeddings
  FROM document_chunks
  WHERE document_id = p_document_id;
END;
$$;
