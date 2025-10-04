const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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

    // Get Supabase service client for server-side validation
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    // Check usage limits with the new comprehensive function
    const limitCheckResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/check_usage_limit`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_user_id: user_id,
          p_feature: "chat_message"
        }),
      }
    );

    if (!limitCheckResponse.ok) {
      throw new Error("Failed to check usage limits");
    }

    const limitCheck = await limitCheckResponse.json();

    // If limit exceeded and user is not admin
    if (!limitCheck.allowed && !limitCheck.is_admin) {
      return new Response(
        JSON.stringify({
          error: "CHAT_LIMIT_REACHED",
          message: `You've reached your daily limit of ${limitCheck.max_limit} chats. Upgrade to continue using easyAI today!`,
          current_usage: limitCheck.current_usage,
          max_limit: limitCheck.max_limit,
          remaining: limitCheck.remaining,
          plan_tier: limitCheck.plan_tier,
          upgrade_needed: true
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
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

    // 3. Get user's subscription plan to determine AI model
    const userResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?select=*,subscription:subscriptions(plan:plans(*))&id=eq.${user_id}`,
      {
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
      }
    );

    if (!userResponse.ok) {
      console.error("Failed to fetch user data");
    }

    const userData = await userResponse.json();
    const userPlan = userData?.[0]?.subscription?.plan;
    const aiModel = userPlan?.ai_model || 'gpt-3.5-turbo';

    // 4. Detect casual conversation and build appropriate prompt
    const lowerMessage = message.toLowerCase().trim();
    const isGreeting = /^(hi|hello|hey|good morning|good afternoon|good evening|greetings)/.test(lowerMessage);
    const isGratitude = /^(thank you|thanks|thank|thx|appreciate|grateful)/.test(lowerMessage);
    const isGoodbye = /^(bye|goodbye|see you|take care|later)/.test(lowerMessage);
    const isCasual = isGreeting || isGratitude || isGoodbye;

    let systemPrompt;

    if (isCasual) {
      systemPrompt = `You are easyAI, a friendly and professional AI legal assistant specializing in Nigerian law. You help lawyers, legal professionals, and students with legal research and analysis.

You are having a natural conversation with a user. Respond warmly and professionally to their message. Keep your response brief and personable, then gently guide them toward how you can help with their legal needs.

IMPORTANT:
- Be warm, approachable, and conversational
- Keep responses brief for casual interactions (2-3 sentences)
- After acknowledging casual messages, mention how you can help with Nigerian law
- Maintain a professional yet friendly tone
- Show personality while remaining helpful`;
    } else {
      systemPrompt = `You are easyAI, a friendly and professional AI legal assistant specializing in Nigerian law. You help lawyers, legal professionals, and students with legal research and analysis.

IMPORTANT GUIDELINES:
- Be conversational and approachable while maintaining professionalism
- Base your responses primarily on the provided legal documents
- Cite relevant cases, statutes, and legal authorities
- Always provide legal citations when referencing cases or statutes
- If a question is outside Nigerian law, clarify but still try to be helpful
- Use clear, accessible language - avoid unnecessary legal jargon
- Always indicate when information comes from the provided documents vs. general legal knowledge
- When users seem confused, acknowledge their concern warmly before providing information

Context from legal documents:
${context}

Please provide helpful, accurate legal information while being clear about limitations and the need for professional legal advice. Be conversational and human in your responses.`;
    }

    let userPrompt;

    if (isCasual) {
      userPrompt = message;
    } else {
      userPrompt = `Legal Question: ${message}

Please provide a comprehensive answer with relevant citations and references.`;
    }

    // 5. Call OpenAI API with plan-specific model
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: isCasual ? 150 : 1500,
        temperature: isCasual ? 0.9 : 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiMessage = openaiData.choices[0].message.content;

    // 6. Format sources (skip for casual conversations)
    const sources = isCasual ? [] : ragResults.map(doc => ({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      citation: doc.citation,
      relevance_score: doc.relevance_score,
      excerpt: doc.excerpt
    }));

    // 7. Track usage after successful message processing
    try {
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/increment_usage_count`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "apikey": supabaseServiceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_user_id: user_id,
            p_feature: "chat_message",
            p_metadata: {
              session_id,
              model: aiModel,
              tokens: openaiData.usage?.total_tokens || 0
            }
          }),
        }
      );
    } catch (trackingError) {
      // Log but don't fail the request if tracking fails
      console.error("Failed to track usage:", trackingError);
    }

    return new Response(
      JSON.stringify({
        message: aiMessage,
        sources,
        metadata: {
          model_used: aiModel,
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
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!openaiApiKey || !supabaseUrl || !supabaseServiceKey) {
      console.warn("Missing configuration for RAG search");
      return [];
    }

    // 1. Generate embeddings for the query
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Embeddings API error: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // 2. Search for similar documents using the embedding
    const documentsResponse = await fetch(
      `${supabaseUrl}/rest/v1/documents?select=*&is_public=eq.true&limit=100`,
      {
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
      }
    );

    if (!documentsResponse.ok) {
      console.error("Failed to fetch documents:", await documentsResponse.text());
      return [];
    }

    const documents = await documentsResponse.json();
    
    if (!documents || documents.length === 0) {
      console.warn("No public documents found in database");
      return [];
    }

    // 3. Calculate cosine similarity and rank results
    const scoredDocs = documents
      .map((doc: any) => {
        if (!doc.embeddings || doc.embeddings.length === 0) {
          return null;
        }

        const similarity = cosineSimilarity(queryEmbedding, doc.embeddings);
        
        return {
          id: doc.id,
          title: doc.title,
          type: doc.type,
          citation: doc.citation,
          relevance_score: similarity,
          excerpt: doc.content ? doc.content.substring(0, 300) + '...' : ''
        };
      })
      .filter((doc: any) => doc !== null && doc.relevance_score > 0.7)
      .sort((a: any, b: any) => b.relevance_score - a.relevance_score)
      .slice(0, 5);

    return scoredDocs;

  } catch (error) {
    console.error("RAG search error:", error);
    return [];
  }
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}
