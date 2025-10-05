import pdfParse from "npm:pdf-parse@1.1.1";
// @deno-types="npm:@types/mammoth@1.0.5"
import mammoth from "npm:mammoth@1.6.0";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fileName = formData.get("fileName") as string;
    const userId = formData.get("userId") as string;

    if (!file || !fileName || !userId) {
      return new Response("Missing required parameters", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 1. Extract text content from file
    let content = '';
    const fileExtension = fileName.split('.').pop()?.toLowerCase();

    if (fileExtension === 'txt') {
      content = await file.text();
    } else if (fileExtension === 'pdf') {
      content = await extractPDFContent(file);
    } else if (fileExtension === 'docx') {
      content = await extractDOCXContent(file);
    } else {
      throw new Error("Unsupported file type");
    }

    // 2. Chunk the content
    const chunks = chunkText(content, 1000, 200);

    // 3. Generate embeddings for each chunk
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    // 4. Store document and chunks in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        title: fileName,
        type: 'case',
        file_url: `documents/${fileName}`,
        content: content,
        metadata: {
          file_size: file.size,
          file_type: fileExtension,
          chunks_count: chunks.length,
          processed_at: new Date().toISOString()
        },
        is_public: false,
        uploaded_by: userId
      })
      .select()
      .single();

    if (docError || !document) {
      throw new Error(`Failed to store document: ${docError?.message}`);
    }

    // Generate embeddings for each chunk
    const embeddings = await generateEmbeddings(chunks, openaiApiKey);

    // Insert document chunks with embeddings
    const chunksData = chunks.map((chunk, index) => ({
      document_id: document.id,
      content: chunk,
      embedding: JSON.stringify(embeddings[index]),
      chunk_index: index,
      metadata: {
        char_count: chunk.length,
        word_count: chunk.split(/\s+/).length
      }
    }));

    const { error: chunksError } = await supabase
      .from('document_chunks')
      .insert(chunksData);

    if (chunksError) {
      console.error('Failed to store chunks:', chunksError);
      throw new Error(`Failed to store document chunks: ${chunksError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_id: document.id,
        chunks_processed: chunks.length,
        message: "Document processed successfully"
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("RAG ingestion error:", error);
    
    return new Response(
      JSON.stringify({
        error: "Failed to process document",
        details: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

async function extractPDFContent(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    const data = await pdfParse(buffer);
    
    if (!data.text || data.text.trim().length === 0) {
      throw new Error("No text content found in PDF");
    }
    
    return data.text;
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error(`Failed to extract PDF content: ${error.message}`);
  }
}

async function extractDOCXContent(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    const result = await mammoth.extractRawText({ buffer });
    
    if (!result.value || result.value.trim().length === 0) {
      throw new Error("No text content found in DOCX");
    }
    
    if (result.messages && result.messages.length > 0) {
      console.warn("DOCX extraction warnings:", result.messages);
    }
    
    return result.value;
  } catch (error) {
    console.error("DOCX extraction error:", error);
    throw new Error(`Failed to extract DOCX content: ${error.message}`);
  }
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // Try to end at a sentence boundary
    if (end < text.length) {
      const lastSentence = chunk.lastIndexOf('.');
      if (lastSentence > chunkSize * 0.5) {
        chunk = chunk.slice(0, lastSentence + 1);
      }
    }

    chunks.push(chunk.trim());
    start = end - overlap;
  }

  return chunks.filter(chunk => chunk.length > 0);
}

async function generateEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const text of texts) {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embeddings API error: ${response.status}`);
    }

    const data = await response.json();
    embeddings.push(data.data[0].embedding);
  }

  return embeddings;
}
