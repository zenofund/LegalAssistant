const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface CitationRequest {
  caseName: string;
  parties?: string;
  year: number;
  court: string;
  reporter: 'NWLR' | 'FWLR';
  volume?: number;
  page: number;
  citationStyle?: 'full' | 'short';
  additionalInfo?: {
    judgmentDate?: string;
    judges?: string[];
    caseNumber?: string;
  };
}

interface CitationResponse {
  success: boolean;
  citation: string;
  style: string;
  metadata?: {
    reporter: string;
    year: number;
    volume?: number;
    page: number;
  };
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

    const {
      caseName,
      parties,
      year,
      court,
      reporter,
      volume,
      page,
      citationStyle = 'full',
      additionalInfo
    }: CitationRequest = await req.json();

    // Validate required fields
    if (!caseName || !year || !court || !reporter || !page) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: caseName, year, court, reporter, and page are required"
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

    // Validate reporter type
    if (!['NWLR', 'FWLR'].includes(reporter)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid reporter. Must be 'NWLR' or 'FWLR'"
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

    // Generate citation based on reporter type
    let citation: string;
    
    if (reporter === 'NWLR') {
      citation = generateNWLRCitation({
        caseName,
        parties,
        year,
        court,
        volume,
        page,
        citationStyle,
        additionalInfo
      });
    } else {
      citation = generateFWLRCitation({
        caseName,
        parties,
        year,
        court,
        volume,
        page,
        citationStyle,
        additionalInfo
      });
    }

    const response: CitationResponse = {
      success: true,
      citation,
      style: `${reporter} ${citationStyle}`,
      metadata: {
        reporter,
        year,
        volume,
        page
      }
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
    console.error("Citation generation error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to generate citation",
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

function generateNWLRCitation({
  caseName,
  parties,
  year,
  court,
  volume,
  page,
  citationStyle,
  additionalInfo
}: Omit<CitationRequest, 'reporter'>): string {
  // NWLR Citation Format: Case Name (Year) Volume NWLR (Pt. Part) Page (Court)
  // Example: Carlill v. Carbolic Smoke Ball Co. (1893) 1 NWLR (Pt. 1) 256 (CA)
  
  let citation = '';
  
  // Case name (use parties if provided, otherwise caseName)
  const displayName = parties || caseName;
  citation += displayName;
  
  // Year in parentheses
  citation += ` (${year})`;
  
  // Volume (if provided)
  if (volume) {
    citation += ` ${volume}`;
  }
  
  // Reporter name
  citation += ' NWLR';
  
  // Part number (derived from volume or year)
  const partNumber = volume || Math.floor((year - 1960) / 10) + 1;
  citation += ` (Pt. ${partNumber})`;
  
  // Page number
  citation += ` ${page}`;
  
  // Court abbreviation
  const courtAbbr = getCourtAbbreviation(court);
  citation += ` (${courtAbbr})`;
  
  // Additional information for full citations
  if (citationStyle === 'full' && additionalInfo) {
    const additionalParts = [];
    
    if (additionalInfo.judgmentDate) {
      additionalParts.push(`decided ${additionalInfo.judgmentDate}`);
    }
    
    if (additionalInfo.judges && additionalInfo.judges.length > 0) {
      const judgesList = additionalInfo.judges.join(', ');
      additionalParts.push(`per ${judgesList}`);
    }
    
    if (additionalInfo.caseNumber) {
      additionalParts.push(`Case No: ${additionalInfo.caseNumber}`);
    }
    
    if (additionalParts.length > 0) {
      citation += ` [${additionalParts.join('; ')}]`;
    }
  }
  
  return citation;
}

function generateFWLRCitation({
  caseName,
  parties,
  year,
  court,
  volume,
  page,
  citationStyle,
  additionalInfo
}: Omit<CitationRequest, 'reporter'>): string {
  // FWLR Citation Format: Case Name (Year) Volume FWLR Page (Court)
  // Example: Carlill v. Carbolic Smoke Ball Co. (1893) 1 FWLR 256 (SC)
  
  let citation = '';
  
  // Case name (use parties if provided, otherwise caseName)
  const displayName = parties || caseName;
  citation += displayName;
  
  // Year in parentheses
  citation += ` (${year})`;
  
  // Volume (if provided, otherwise derive from year)
  const volumeNumber = volume || Math.max(1, year - 1979);
  citation += ` ${volumeNumber}`;
  
  // Reporter name
  citation += ' FWLR';
  
  // Page number
  citation += ` ${page}`;
  
  // Court abbreviation
  const courtAbbr = getCourtAbbreviation(court);
  citation += ` (${courtAbbr})`;
  
  // Additional information for full citations
  if (citationStyle === 'full' && additionalInfo) {
    const additionalParts = [];
    
    if (additionalInfo.judgmentDate) {
      additionalParts.push(`decided ${additionalInfo.judgmentDate}`);
    }
    
    if (additionalInfo.judges && additionalInfo.judges.length > 0) {
      const judgesList = additionalInfo.judges.join(', ');
      additionalParts.push(`per ${judgesList}`);
    }
    
    if (additionalInfo.caseNumber) {
      additionalParts.push(`Case No: ${additionalInfo.caseNumber}`);
    }
    
    if (additionalParts.length > 0) {
      citation += ` [${additionalParts.join('; ')}]`;
    }
  }
  
  return citation;
}

function getCourtAbbreviation(court: string): string {
  const courtMappings: Record<string, string> = {
    // Supreme Court
    'supreme court': 'SC',
    'supreme court of nigeria': 'SC',
    'sc': 'SC',
    
    // Court of Appeal
    'court of appeal': 'CA',
    'ca': 'CA',
    
    // Federal High Court
    'federal high court': 'FHC',
    'fhc': 'FHC',
    
    // High Court (State)
    'high court': 'HC',
    'state high court': 'HC',
    'hc': 'HC',
    
    // Lagos State High Court
    'lagos state high court': 'LSHC',
    'lshc': 'LSHC',
    
    // Abuja High Court
    'high court of fct': 'FHCT',
    'fct high court': 'FHCT',
    'abuja high court': 'FHCT',
    
    // Customary Court
    'customary court': 'CC',
    'customary court of appeal': 'CCA',
    
    // Sharia Court
    'sharia court': 'SHC',
    'sharia court of appeal': 'SCA',
    
    // Industrial Court
    'national industrial court': 'NICN',
    'industrial court': 'NICN',
    'nicn': 'NICN',
    
    // Tax Appeal Tribunal
    'tax appeal tribunal': 'TAT',
    'tat': 'TAT',
    
    // Election Petition Tribunal
    'election petition tribunal': 'EPT',
    'ept': 'EPT',
    
    // Court of Appeal (Election)
    'court of appeal election': 'CA(E)',
    
    // Magistrate Court
    'magistrate court': 'MC',
    'magistrates court': 'MC',
    'mc': 'MC'
  };
  
  const normalizedCourt = court.toLowerCase().trim();
  return courtMappings[normalizedCourt] || court.toUpperCase();
}