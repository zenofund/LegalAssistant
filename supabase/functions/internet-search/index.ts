const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SearchRequest {
  query: string;
  user_id: string;
  max_results?: number;
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

    const { query, user_id, max_results = 5 }: SearchRequest = await req.json();

    if (!query || !user_id) {
      return new Response("Missing required parameters", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Get SerpAPI key
    const serpApiKey = Deno.env.get('SERPAPI_API_KEY');
    if (!serpApiKey) {
      throw new Error('SerpAPI key not configured');
    }

    // Enhance query for legal search
    const enhancedQuery = `${query} Nigeria law legal case statute`;

    // Search using SerpAPI
    const searchUrl = new URL('https://serpapi.com/search');
    searchUrl.searchParams.set('engine', 'google');
    searchUrl.searchParams.set('q', enhancedQuery);
    searchUrl.searchParams.set('api_key', serpApiKey);
    searchUrl.searchParams.set('num', max_results.toString());
    searchUrl.searchParams.set('gl', 'ng'); // Nigeria
    searchUrl.searchParams.set('hl', 'en'); // English

    const response = await fetch(searchUrl.toString());
    
    if (!response.ok) {
      throw new Error(`SerpAPI error: ${response.status}`);
    }

    const searchData = await response.json();

    // Process and format results
    const results = (searchData.organic_results || []).map((result: any) => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet,
      source: extractDomain(result.link),
      relevance_score: calculateRelevance(result, query),
      type: classifyLegalContent(result.title, result.snippet)
    }));

    // Filter for legal relevance
    const legalResults = results.filter((result: any) => 
      result.relevance_score > 0.3 || 
      result.type !== 'general'
    );

    // Sort by relevance
    legalResults.sort((a: any, b: any) => b.relevance_score - a.relevance_score);

    return new Response(
      JSON.stringify({
        success: true,
        query: enhancedQuery,
        results: legalResults.slice(0, max_results),
        total_results: legalResults.length,
        search_metadata: {
          processed_at: new Date().toISOString(),
          source: 'serpapi',
          country: 'Nigeria'
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
    console.error("Internet search error:", error);
    
    return new Response(
      JSON.stringify({
        error: "Failed to perform internet search",
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

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

function calculateRelevance(result: any, query: string): number {
  const title = (result.title || '').toLowerCase();
  const snippet = (result.snippet || '').toLowerCase();
  const queryLower = query.toLowerCase();
  
  let score = 0;
  
  // Legal keywords boost
  const legalKeywords = [
    'law', 'legal', 'court', 'case', 'statute', 'act', 'constitution',
    'judgment', 'ruling', 'precedent', 'nigeria', 'nigerian', 'supreme court',
    'high court', 'appeal', 'federal', 'state', 'jurisdiction'
  ];
  
  legalKeywords.forEach(keyword => {
    if (title.includes(keyword)) score += 0.2;
    if (snippet.includes(keyword)) score += 0.1;
  });
  
  // Query term matching
  const queryTerms = queryLower.split(' ');
  queryTerms.forEach(term => {
    if (term.length > 2) {
      if (title.includes(term)) score += 0.3;
      if (snippet.includes(term)) score += 0.2;
    }
  });
  
  // Domain authority boost for legal sites
  const legalDomains = [
    'lawpavilion.com', 'nigerianlawguru.com', 'lawnigeria.com',
    'nigerialii.org', 'supremecourt.gov.ng', 'nials.edu.ng'
  ];
  
  const domain = extractDomain(result.link);
  if (legalDomains.some(d => domain.includes(d))) {
    score += 0.4;
  }
  
  return Math.min(score, 1.0);
}

function classifyLegalContent(title: string, snippet: string): string {
  const content = `${title} ${snippet}`.toLowerCase();
  
  if (content.includes('case') || content.includes('judgment') || content.includes('ruling')) {
    return 'case';
  }
  
  if (content.includes('act') || content.includes('statute') || content.includes('constitution')) {
    return 'statute';
  }
  
  if (content.includes('regulation') || content.includes('rule') || content.includes('order')) {
    return 'regulation';
  }
  
  if (content.includes('law') || content.includes('legal') || content.includes('court')) {
    return 'legal';
  }
  
  return 'general';
}