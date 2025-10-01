const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ChatRequest {
  message: string;
  session_id: string;
  user_id: string;
}

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

    const { message, session_id, user_id }: ChatRequest = await req.json();

    if (!message || !session_id || !user_id) {
      return new Response("Missing required parameters", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Initialize OpenAI
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    // 1. Perform RAG search for relevant documents
    const ragResults = await performRAGSearch(message);

    // 2. Prepare context from RAG results
    const context = ragResults.map(doc => 
      `Document: ${doc.title}\nCitation: ${doc.citation || 'N/A'}\nContent: ${doc.excerpt}`
    ).join('\n\n');

    // 3. Build the prompt
    const systemPrompt = `You are an AI legal assistant specializing in Nigerian law. You help lawyers, legal professionals, and students with legal research and analysis.

IMPORTANT GUIDELINES:
- Base your responses primarily on the provided legal documents
- Cite relevant cases, statutes, and legal authorities
- Always provide legal citations when referencing cases or statutes
- If a question is outside Nigerian law, clarify but still try to be helpful
- Be precise and professional in your language
- Always indicate when information comes from the provided documents vs. general legal knowledge

Context from legal documents:
${context}

Please provide helpful, accurate legal information while being clear about limitations and the need for professional legal advice.`;

    const userPrompt = `Legal Question: ${message}

Please provide a comprehensive answer with relevant citations and references.`;

    // 4. Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiMessage = openaiData.choices[0].message.content;

    // 5. Format sources
    const sources = ragResults.map(doc => ({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      citation: doc.citation,
      relevance_score: doc.relevance_score,
      excerpt: doc.excerpt
    }));

    return new Response(
      JSON.stringify({
        message: aiMessage,
        sources,
        metadata: {
          model_used: "gpt-4",
          tokens_used: openaiData.usage?.total_tokens || 0,
          context_documents: ragResults.length
        }
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
    console.error("Chat function error:", error);
    
    return new Response(
      JSON.stringify({
        error: "An error occurred while processing your request",
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

async function performRAGSearch(query: string) {
  try {
    // This would typically involve:
    // 1. Generate embeddings for the query using OpenAI embeddings API
    // 2. Search the vector database for similar documents
    // 3. Return the most relevant results

    // For now, return mock results - replace with actual RAG implementation
    return [
      {
        id: "1",
        title: "Nigerian Constitution 1999 (as amended)",
        type: "statute",
        citation: "1999 Constitution",
        relevance_score: 0.95,
        excerpt: "The Constitution of the Federal Republic of Nigeria 1999 is the supreme law of Nigeria..."
      },
      {
        id: "2", 
        title: "Companies and Allied Matters Act 2020",
        type: "statute",
        citation: "CAMA 2020",
        relevance_score: 0.88,
        excerpt: "The Companies and Allied Matters Act 2020 governs company incorporation and operations..."
      }
    ];

  } catch (error) {
    console.error("RAG search error:", error);
    return [];
  }
}