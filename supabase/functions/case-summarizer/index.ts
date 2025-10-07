import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CaseSummarizerRequest {
  case_text?: string;
  document_id?: string;
  summary_type?: 'standard' | 'detailed' | 'brief';
  user_id: string;
}

interface CaseSummaryResponse {
  success: boolean;
  summary?: {
    id: string;
    title: string;
    case_name: string;
    case_citation: string;
    facts: string;
    issues: string[];
    holding: string;
    reasoning: string;
    ratio_decidendi: string;
    obiter_dicta: string;
    jurisdiction: string;
    court: string;
    year: number;
    judges: string[];
  };
  error?: string;
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

    const {
      case_text,
      document_id,
      summary_type = 'standard',
      user_id
    }: CaseSummarizerRequest = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "User ID is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!case_text && !document_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Either case_text or document_id is required"
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
          success: false,
          error: "OpenAI API key not configured. Please contact support."
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
        JSON.stringify({ success: false, error: "Failed to load user profile" }),
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

    if (!isAdmin && plan?.tier === 'free') {
      return new Response(
        JSON.stringify({
          success: false,
          error: "FEATURE_RESTRICTED",
          message: "Case Summarizer is only available for Pro and Enterprise users. Please upgrade your plan.",
          required_tier: "pro",
          current_tier: plan?.tier || 'free'
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check usage limits for Pro users (20/day)
    if (!isAdmin && plan?.tier === 'pro') {
      const maxSummariesPerDay = plan?.max_summaries_per_day || 20;
      const today = new Date().toISOString().split('T')[0];

      const { data: usageData } = await supabase
        .from('usage_tracking')
        .select('count')
        .eq('user_id', user_id)
        .eq('feature', 'case_summarizer')
        .eq('date', today)
        .single();

      const currentUsage = usageData?.count || 0;

      if (currentUsage >= maxSummariesPerDay) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "LIMIT_REACHED",
            message: `Daily Case Summarizer limit reached (${maxSummariesPerDay}/day). Your limit will reset tomorrow.`,
            current_usage: currentUsage,
            max_limit: maxSummariesPerDay
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

    let caseTextToAnalyze = case_text;
    let documentTitle = 'Case Summary';
    
    if (document_id && !case_text) {
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('title, content, citation, type')
        .eq('id', document_id)
        .single();

      if (docError || !document) {
        return new Response(
          JSON.stringify({ success: false, error: "Document not found" }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      if (document.type !== 'case') {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Document is not a case. Case Summarizer only works with case documents."
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

      caseTextToAnalyze = document.content;
      documentTitle = document.title || 'Case Summary';
    }

    if (!caseTextToAnalyze || caseTextToAnalyze.trim().length < 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Case text is too short. Please provide a complete case text for analysis."
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

    const summaryInstructions = getSummaryInstructions(summary_type);
    const modelToUse = plan?.ai_model || 'gpt-4o-mini';

    const systemPrompt = `You are an expert legal analyst specializing in Nigerian law with extensive experience in case analysis and legal research. Your task is to analyze the provided legal case and extract key information in a structured format.

${summaryInstructions}

You must respond with a valid JSON object containing the following fields:
{
  "case_name": "Full name of the case",
  "case_citation": "Official citation if available",
  "facts": "Clear, concise summary of the facts",
  "issues": ["Array of legal issues presented"],
  "holding": "The court's decision",
  "reasoning": "The court's reasoning and analysis",
  "ratio_decidendi": "The binding legal principle established",
  "obiter_dicta": "Any non-binding remarks or observations",
  "jurisdiction": "The jurisdiction (e.g., 'nigeria', 'england')",
  "court": "The court that decided the case",
  "year": The year as a number,
  "judges": ["Array of judge names if available"]
}

Be thorough, accurate, and ensure all legal principles are clearly identified.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this legal case:\n\n${caseTextToAnalyze}` }
        ],
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API error:', errorData);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to generate case summary. Please try again."
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

    let summaryData;
    try {
      summaryData = JSON.parse(aiMessage);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to parse case summary. Please try again."
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

    const { data: savedSummary, error: saveError } = await supabase
      .from('case_summaries')
      .insert({
        user_id: user_id,
        document_id: document_id || null,
        title: documentTitle,
        case_name: summaryData.case_name || 'Unknown Case',
        case_citation: summaryData.case_citation || null,
        facts: summaryData.facts || '',
        issues: summaryData.issues || [],
        holding: summaryData.holding || '',
        reasoning: summaryData.reasoning || '',
        ratio_decidendi: summaryData.ratio_decidendi || null,
        obiter_dicta: summaryData.obiter_dicta || null,
        jurisdiction: summaryData.jurisdiction || 'nigeria',
        court: summaryData.court || null,
        year: summaryData.year || null,
        judges: summaryData.judges || [],
        summary_type: summary_type,
        ai_model_used: modelToUse,
        tokens_used: tokensUsed,
        metadata: {
          generated_at: new Date().toISOString(),
          source: document_id ? 'document' : 'text_input'
        }
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving summary:', saveError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to save case summary. Please try again."
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

      // Get current usage count
      const { data: currentUsage } = await supabase
        .from('usage_tracking')
        .select('count')
        .eq('user_id', user_id)
        .eq('feature', 'case_summarizer')
        .eq('date', today)
        .single();

      // Increment count
      await supabase
        .from('usage_tracking')
        .upsert({
          user_id: user_id,
          feature: 'case_summarizer',
          date: today,
          count: (currentUsage?.count || 0) + 1,
          metadata: {
            last_used_at: new Date().toISOString(),
            tokens_used: tokensUsed
          }
        }, {
          onConflict: 'user_id,feature,date',
          ignoreDuplicates: false
        });
    }

    const response: CaseSummaryResponse = {
      success: true,
      summary: savedSummary
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Case summarizer error:", error);

    return new Response(
      JSON.stringify({
        success: false,
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

function getSummaryInstructions(type: string): string {
  switch (type) {
    case 'detailed':
      return `Provide a comprehensive and detailed analysis. Include:
- Extensive factual background
- All legal issues with thorough explanations
- Complete reasoning with references to legal authorities
- Detailed ratio decidendi with all supporting arguments
- Comprehensive obiter dicta analysis`;
    
    case 'brief':
      return `Provide a concise summary focusing on:
- Key facts only (2-3 sentences)
- Main legal issues (bullet points)
- Core holding (1-2 sentences)
- Essential reasoning (brief paragraph)
- Primary ratio decidendi (1-2 sentences)`;
    
    default:
      return `Provide a balanced summary with:
- Clear statement of facts
- Well-defined legal issues
- Comprehensive holding
- Structured reasoning
- Clear identification of ratio decidendi and obiter dicta`;
  }
}