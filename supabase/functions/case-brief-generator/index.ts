import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CaseBriefRequest {
  case_text?: string;
  document_id?: string;
  brief_type: 'trial' | 'appellate' | 'memorandum' | 'motion';
  jurisdiction: string;
  court: string;
  case_number?: string;
  parties_plaintiff?: string;
  parties_defendant?: string;
  additional_instructions?: string;
  user_id: string;
}

interface CaseBriefResponse {
  success: boolean;
  brief?: any;
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

    const requestData: CaseBriefRequest = await req.json();
    const {
      case_text,
      document_id,
      brief_type,
      jurisdiction,
      court,
      case_number,
      parties_plaintiff,
      parties_defendant,
      additional_instructions,
      user_id
    } = requestData;

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

    if (!brief_type || !jurisdiction || !court) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Brief type, jurisdiction, and court are required"
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
          message: "Case Brief Generator is only available for Pro and Enterprise users. Please upgrade your plan.",
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
      const maxBriefsPerDay = plan?.max_briefs_per_day || 20;
      const today = new Date().toISOString().split('T')[0];

      const { data: usageData } = await supabase
        .from('usage_tracking')
        .select('count')
        .eq('user_id', user_id)
        .eq('feature', 'case_brief_generator')
        .eq('date', today)
        .single();

      const currentUsage = usageData?.count || 0;

      if (currentUsage >= maxBriefsPerDay) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "LIMIT_REACHED",
            message: `Daily Brief Generator limit reached (${maxBriefsPerDay}/day). Your limit will reset tomorrow.`,
            current_usage: currentUsage,
            max_limit: maxBriefsPerDay
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
    let documentTitle = 'Legal Brief';
    
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

      caseTextToAnalyze = document.content;
      documentTitle = document.title || 'Legal Brief';
    }

    if (!caseTextToAnalyze || caseTextToAnalyze.trim().length < 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Case text is too short. Please provide complete case information for brief generation."
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

    const briefInstructions = getBriefInstructions(brief_type);
    const modelToUse = plan?.ai_model || 'gpt-4o-mini';

    const systemPrompt = `You are an expert legal brief writer specializing in Nigerian law with extensive experience in legal drafting and advocacy. Your task is to generate a comprehensive, professional legal brief based on the provided information.

${briefInstructions}

CRITICAL: You must respond with a valid, complete JSON object. Ensure all JSON brackets and braces are properly closed.

Required JSON structure:
{
  "title": "Brief title",
  "introduction": "Opening statement introducing the matter",
  "statement_of_facts": "Detailed factual background",
  "issues_presented": ["Array of legal issues to be addressed"],
  "legal_arguments": "Main legal arguments with authorities",
  "analysis": "Detailed legal analysis applying law to facts",
  "conclusion": "Summary and relief sought",
  "prayer_for_relief": "Specific relief requested from the court",
  "citations_used": ["Array of legal authorities cited"]
}

All fields are required. Use empty strings or empty arrays if content is not applicable.

Ensure the brief is:
- Professional and persuasive
- Well-structured with clear headings
- Properly cited with relevant authorities
- Tailored to ${jurisdiction} jurisdiction and ${court}
- Appropriate for ${brief_type} brief format
- Complete with all JSON structure properly closed

${additional_instructions ? `Additional instructions: ${additional_instructions}` : ''}

IMPORTANT: If you approach the token limit, prioritize completing the JSON structure over verbose content. Ensure the response ends with a closing brace.`;

    const userPrompt = `Generate a ${brief_type} brief for ${court} in ${jurisdiction}.\n\n` +
      (parties_plaintiff ? `Plaintiff: ${parties_plaintiff}\n` : '') +
      (parties_defendant ? `Defendant: ${parties_defendant}\n` : '') +
      (case_number ? `Case Number: ${case_number}\n` : '') +
      `\nCase Information:\n${caseTextToAnalyze}`;

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
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 6000,
        response_format: { type: 'json_object' }
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API error:', errorData);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to generate legal brief. Please try again."
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

    // Validate OpenAI response structure
    if (!aiData || !aiData.choices || aiData.choices.length === 0) {
      console.error('Invalid OpenAI response structure:', JSON.stringify(aiData));
      return new Response(
        JSON.stringify({
          success: false,
          error: "Received invalid response from AI service. Please try again."
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

    const choice = aiData.choices[0];
    const aiMessage = choice?.message?.content;
    const tokensUsed = aiData.usage?.total_tokens || 0;
    const finishReason = choice?.finish_reason;

    // Check if response was truncated
    if (finishReason === 'length') {
      console.error('OpenAI response was truncated due to token limit');
      return new Response(
        JSON.stringify({
          success: false,
          error: "Brief generation exceeded length limit. Please try with shorter input or contact support."
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

    // Validate AI message content
    if (!aiMessage || typeof aiMessage !== 'string' || aiMessage.trim().length === 0) {
      console.error('Empty or invalid AI message:', aiMessage);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Received empty response from AI service. Please try again."
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

    // Check for complete JSON structure
    const trimmedMessage = aiMessage.trim();
    if (!trimmedMessage.startsWith('{') || !trimmedMessage.endsWith('}')) {
      console.error('AI response is not valid JSON format:', trimmedMessage.substring(0, 200));
      return new Response(
        JSON.stringify({
          success: false,
          error: "Received malformed response from AI service. Please try again."
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

    let briefData;
    try {
      briefData = JSON.parse(aiMessage);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('AI message content (first 500 chars):', aiMessage.substring(0, 500));
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to parse generated brief. The response may be incomplete. Please try again."
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

    // Validate parsed data structure
    if (!briefData || typeof briefData !== 'object') {
      console.error('Parsed brief data is not an object:', briefData);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Generated brief has invalid structure. Please try again."
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

    // Ensure required fields have defaults
    briefData = {
      title: briefData.title || documentTitle,
      introduction: briefData.introduction || '',
      statement_of_facts: briefData.statement_of_facts || '',
      issues_presented: Array.isArray(briefData.issues_presented) ? briefData.issues_presented : [],
      legal_arguments: briefData.legal_arguments || '',
      analysis: briefData.analysis || '',
      conclusion: briefData.conclusion || '',
      prayer_for_relief: briefData.prayer_for_relief || null,
      citations_used: Array.isArray(briefData.citations_used) ? briefData.citations_used : []
    };

    const { data: savedBrief, error: saveError } = await supabase
      .from('case_briefs')
      .insert({
        user_id: user_id,
        document_id: document_id || null,
        title: briefData.title || documentTitle,
        brief_type: brief_type,
        jurisdiction: jurisdiction,
        court: court,
        case_number: case_number || null,
        parties_plaintiff: parties_plaintiff || null,
        parties_defendant: parties_defendant || null,
        introduction: briefData.introduction || '',
        statement_of_facts: briefData.statement_of_facts || '',
        issues_presented: briefData.issues_presented || [],
        legal_arguments: briefData.legal_arguments || '',
        analysis: briefData.analysis || '',
        conclusion: briefData.conclusion || '',
        prayer_for_relief: briefData.prayer_for_relief || null,
        citations_used: briefData.citations_used || [],
        draft_status: true,
        metadata: {
          generated_at: new Date().toISOString(),
          source: document_id ? 'document' : 'text_input',
          ai_model: modelToUse,
          tokens_used: tokensUsed
        },
        ai_model_used: modelToUse,
        tokens_used: tokensUsed
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving brief:', saveError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to save legal brief. Please try again."
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
        .eq('feature', 'case_brief_generator')
        .eq('date', today)
        .single();

      // Increment count
      await supabase
        .from('usage_tracking')
        .upsert({
          user_id: user_id,
          feature: 'case_brief_generator',
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

    const response: CaseBriefResponse = {
      success: true,
      brief: savedBrief
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
    console.error("Case brief generator error:", error);

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

function getBriefInstructions(type: string): string {
  switch (type) {
    case 'trial':
      return `Generate a Trial Brief with:
- Clear statement of facts
- Issues to be tried
- Legal arguments with supporting case law
- Application of law to facts
- Proposed findings and relief`;
    
    case 'appellate':
      return `Generate an Appellate Brief with:
- Statement of jurisdiction
- Issues presented for review
- Standard of review
- Argument section with legal analysis
- Statement of facts from trial record
- Prayer for relief on appeal`;
    
    case 'memorandum':
      return `Generate a Memorandum of Law with:
- Question presented
- Brief answer
- Statement of facts
- Discussion and analysis
- Conclusion with legal advice`;
    
    case 'motion':
      return `Generate a Motion Brief with:
- Statement of relief sought
- Factual background
- Legal basis for motion
- Supporting arguments with authorities
- Prayer for specific relief`;
    
    default:
      return `Generate a comprehensive legal brief with all standard sections.`;
  }
}