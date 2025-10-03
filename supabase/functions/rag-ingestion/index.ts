// @deno-types="npm:@types/pdf-parse@1.1.1"
import pdfParse from "npm:pdf-parse@1.1.5";
// @deno-types="npm:@types/mammoth@1.0.5"
import mammoth from "npm:mammoth@1.6.0";

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
      // For PDF extraction, you would typically use a library like pdf-parse
      // For now, we'll use a placeholder
      content = await extractPDFContent(file);
    } else if (fileExtension === 'docx') {
      // For DOCX extraction, you would use a library like mammoth
      content = await extractDOCXContent(file);
    } else {
      throw new Error("Unsupported file type");
    }

    // 2. Chunk the content
    const chunks = chunkText(content, 1000, 200); // 1000 chars per chunk, 200 overlap

    // 3. Generate embeddings for each chunk
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const embeddings = await generateEmbeddings(chunks, openaiApiKey);

    // 4. Store document and chunks in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    // Create document record
    const documentResponse = await fetch(`${supabaseUrl}/rest/v1/documents`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
        "apikey": supabaseServiceKey,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        title: fileName,
        type: 'case', // This should be determined from content analysis
        file_url: `documents/${fileName}`,
        content: content,
        embeddings: embeddings[0], // Store first chunk embedding as representative
        metadata: {
          file_size: file.size,
          file_type: fileExtension,
          chunks_count: chunks.length,
          processed_at: new Date().toISOString()
        },
        is_public: true, // Make documents searchable
        uploaded_by: userId
      })
    });

    if (!documentResponse.ok) {
      const errorText = await documentResponse.text();
      throw new Error(`Failed to store document: ${errorText}`);
    }

    const documentData = await documentResponse.json();
    const document = Array.isArray(documentData) ? documentData[0] : documentData;

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
        model: "text-embedding-3-small",
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