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
        subscriptions (
          *,
          plan:plans (*)
        )
      `)
      .eq('id', user_id)
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

      if (limitCheck && !limitCheck.can_use) {
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

    const { data: chatHistory } = await supabase
      .from('chats')
      .select('message, role')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(10);

    const messages = [
      {
        role: "system",
        content: "You are easyAI, an expert legal research assistant specializing in Nigerian law. Provide accurate, professional, and well-structured legal information. Use markdown formatting for better readability. Always cite relevant laws, cases, and legal principles when applicable."
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

    const modelToUse = plan?.ai_model || 'gpt-3.5-turbo';

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API error:', errorData);

      if (openaiResponse.status === 429) {
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
      }

      return new Response(
        JSON.stringify({
          error: "AI_SERVER_ERROR:Failed to get response from AI service. Please try again."
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
    const aiMessage = aiData.choices[0].message.content;
    const tokensUsed = aiData.usage?.total_tokens || 0;

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

    return new Response(
      JSON.stringify({
        message: aiMessage,
        sources: [],
        metadata: {
          model_used: modelToUse,
          tokens_used: tokensUsed
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
