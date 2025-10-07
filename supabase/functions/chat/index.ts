import { createClient } from 'npm:@supabase/supabase-js@2';

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

interface DocumentChunk {
  chunk_id: string;
  document_id: string;
  document_title: string;
  document_type: string;
  document_citation: string | null;
  chunk_content: string;
  similarity: number;
  metadata: any;
}

// Generate embeddings using OpenAI API
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Embedding generation failed:', error);
    throw new Error('Failed to generate embedding');
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Build context from retrieved documents
function buildRAGContext(chunks: DocumentChunk[]): string {
  if (chunks.length === 0) {
    return '';
  }

  let context = '\n\n## Relevant Legal Documents\n\n';

  chunks.forEach((chunk, index) => {
    context += `### Source ${index + 1}: ${chunk.document_title}\n`;
    if (chunk.document_citation) {
      context += `**Citation:** ${chunk.document_citation}\n`;
    }
    context += `**Type:** ${chunk.document_type}\n`;
    context += `**Relevance:** ${(chunk.similarity * 100).toFixed(1)}%\n\n`;
    context += `${chunk.chunk_content}\n\n`;
    context += '---\n\n';
  });

  return context;
}

// Format sources for response
function formatSources(chunks: DocumentChunk[]): any[] {
  return chunks.map(chunk => ({
    id: chunk.document_id,
    title: chunk.document_title,
    type: chunk.document_type,
    citation: chunk.document_citation,
    relevance: chunk.similarity,
    excerpt: chunk.chunk_content.substring(0, 200) + '...',
    metadata: chunk.metadata,
  }));
}

// Map configured model names to actual OpenAI API model names
// This allows flexibility in database configuration while ensuring API compatibility
function getOpenAIModel(configuredModel: string): string {
  const modelMap: Record<string, string> = {
    'gpt-5': 'gpt-4o',
    'gpt-5-mini': 'gpt-4o-mini',
    'gpt-5-nano': 'gpt-4o-mini',
    'gpt-4o': 'gpt-4o',
    'gpt-4o-mini': 'gpt-4o-mini',
    'gpt-4-turbo': 'gpt-4-turbo-preview',
    'gpt-4': 'gpt-4',
    'gpt-3.5-turbo': 'gpt-3.5-turbo'
  };

  return modelMap[configuredModel] || 'gpt-4o-mini';
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { message, session_id, user_id }: ChatRequest = await req.json();

    if (!message || !session_id || !user_id) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: message, session_id, and user_id are required"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: "AI_SERVER_ERROR:OpenAI API key not configured. Please contact support."
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select(`
        *,
        subscriptions!subscriptions_user_id_fkey (
          *,
          plan:plans (*)
        )
      `)
      .eq('id', user_id)
      .eq('subscriptions.status', 'active')
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Failed to load user profile" }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const subscription = profile.subscriptions?.[0];
    const plan = subscription?.plan;
    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

    if (!isAdmin && plan && plan.max_chats_per_day !== -1) {
      const { data: limitCheck, error: limitError } = await supabase.rpc('check_usage_limit', {
        p_user_id: user_id,
        p_feature: 'chat_message'
      });

      if (limitError) {
        console.error('Error checking usage limit:', limitError);
      }

      if (limitCheck && !limitCheck.allowed) {
        return new Response(
          JSON.stringify({
            error: "CHAT_LIMIT_REACHED",
            current_usage: limitCheck.current_usage,
            max_limit: limitCheck.max_limit,
            remaining: 0,
            plan_tier: plan.tier,
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
    }

    // Generate embedding for the user's query
    let queryEmbedding: number[] | null = null;
    let retrievedChunks: DocumentChunk[] = [];

    try {
      queryEmbedding = await generateEmbedding(message, openaiApiKey);

      // Perform semantic search on document chunks
      const { data: chunks, error: searchError } = await supabase
        .rpc('match_document_chunks', {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: 0.85,
          match_count: 5,
          filter_user_id: user_id,
        });

      if (searchError) {
        console.error('Document search error:', searchError);
      } else if (chunks && chunks.length > 0) {
        retrievedChunks = chunks;
        console.log(`Found ${chunks.length} relevant document chunks`);
      }
    } catch (embeddingError) {
      console.error('RAG retrieval failed:', embeddingError);
      // Continue without RAG context
    }

    const { data: chatHistory } = await supabase
      .from('chats')
      .select('message, role')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(10);

    // Build enhanced context with retrieved documents
    const ragContext = buildRAGContext(retrievedChunks);
    const systemPrompt = `You are easyAI, an expert legal research assistant specializing in Nigerian law. Provide accurate, professional, and well-structured legal information. Use markdown formatting for better readability. Always cite relevant laws, cases, and legal principles when applicable.

**CRITICAL INSTRUCTION:** You MUST ONLY answer questions related to law, legal matters, legal research, court cases, statutes, regulations, legal procedures, and legal education. If a user asks about topics unrelated to law (such as cooking, sports, entertainment, technology not related to legal practice, general knowledge, or any non-legal subject), politely decline and redirect them to ask legal questions.

For non-legal questions, respond with: "I am a specialized legal research assistant focused on Nigerian law and legal matters. I can only assist with questions related to law, legal cases, statutes, regulations, legal procedures, and legal research. Please ask me a question about law, and I'll be happy to help!"

${ragContext ? '**IMPORTANT:** You have access to relevant legal documents below. Use them to provide accurate, cited answers. Always reference the specific documents when using their information.' + ragContext : ''}`;

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...(chatHistory || []).map(msg => ({
        role: msg.role,
        content: msg.message
      })),
      {
        role: "user",
        content: message
      }
    ];

    const configuredModel = plan?.ai_model || 'gpt-4o-mini';
    const modelToUse = getOpenAIModel(configuredModel);

    console.log(`Using model: ${modelToUse} (configured: ${configuredModel}) for user ${user_id}`);

    let openaiResponse;
    let actualModelUsed = modelToUse;

    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: messages,
          max_tokens: 2000,
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error(`OpenAI API error (${openaiResponse.status}):`, errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }

        if (openaiResponse.status === 404 && errorData.error?.message?.includes('model')) {
          console.log(`Model ${modelToUse} not found, falling back to gpt-4o-mini`);
          actualModelUsed = 'gpt-4o-mini';

          openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: messages,
              max_tokens: 2000,
            }),
          });

          if (!openaiResponse.ok) {
            const fallbackErrorText = await openaiResponse.text();
            console.error('Fallback model also failed:', fallbackErrorText);
            throw new Error(`Fallback model failed: ${fallbackErrorText}`);
          }
        } else if (openaiResponse.status === 429) {
          return new Response(
            JSON.stringify({
              error: "AI_RATE_LIMIT:The AI service is currently experiencing high demand. Please try again in a moment."
            }),
            {
              status: 429,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        } else if (openaiResponse.status === 401) {
          return new Response(
            JSON.stringify({
              error: "AI_SERVER_ERROR:API authentication failed. Please contact support."
            }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        } else {
          return new Response(
            JSON.stringify({
              error: `AI_SERVER_ERROR:Failed to get response from AI service. Please try again. (Status: ${openaiResponse.status})`
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
      }
    } catch (fetchError) {
      console.error('Network error calling OpenAI:', fetchError);
      return new Response(
        JSON.stringify({
          error: "AI_SERVER_ERROR:Network error connecting to AI service. Please check your connection and try again."
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

    const aiData = await openaiResponse.json();
    const aiMessage = aiData.choices?.[0]?.message?.content;
    const tokensUsed = aiData.usage?.total_tokens || 0;

    if (!aiMessage) {
      console.error('No message in AI response:', aiData);
      return new Response(
        JSON.stringify({
          error: "AI_SERVER_ERROR:Invalid response from AI service. Please try again."
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

    if (!isAdmin) {
      const today = new Date().toISOString().split('T')[0];

      await supabase
        .from('usage_tracking')
        .upsert({
          user_id: user_id,
          feature: 'chat_message',
          date: today,
          count: 1
        }, {
          onConflict: 'user_id,feature,date',
          ignoreDuplicates: false
        });
    }

    // Format sources from retrieved chunks
    const sources = formatSources(retrievedChunks);

    // Save assistant message with sources
    await supabase
      .from('chats')
      .insert({
        user_id: user_id,
        session_id: session_id,
        message: aiMessage,
        role: 'assistant',
        sources: sources,
        tokens_used: tokensUsed,
        model_used: actualModelUsed,
        metadata: {
          rag_enabled: retrievedChunks.length > 0,
          chunks_retrieved: retrievedChunks.length,
        }
      });

    return new Response(
      JSON.stringify({
        message: aiMessage,
        sources: sources,
        metadata: {
          model_used: actualModelUsed,
          configured_model: configuredModel,
          tokens_used: tokensUsed,
          rag_enabled: retrievedChunks.length > 0,
          chunks_retrieved: retrievedChunks.length
        },
        tokens_used: tokensUsed
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
    console.error("Chat error:", error);

    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred",
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
