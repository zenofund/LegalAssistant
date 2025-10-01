/*
  # Seed Data for easyAI Application

  1. Subscription Plans
    - Free Plan: Basic features for individual users
    - Pro Plan: Advanced features with internet search
    - Enterprise Plan: Full feature set with collaboration

  2. Sample Documents
    - Nigerian Constitution excerpts
    - Sample case law
    - Legal templates

  3. Admin User
    - Default super admin account
*/

-- Insert subscription plans
INSERT INTO plans (id, name, tier, features, price, billing_cycle, max_documents, max_chats_per_day, internet_search, ai_drafting, collaboration) VALUES
(
  gen_random_uuid(),
  'Free Plan',
  'free',
  '{
    "chat_sessions": "unlimited",
    "document_upload": "basic",
    "ai_responses": "standard",
    "export_formats": ["txt"],
    "support": "community"
  }',
  0,
  'monthly',
  10,
  50,
  false,
  false,
  false
),
(
  gen_random_uuid(),
  'Pro Plan',
  'pro',
  '{
    "chat_sessions": "unlimited",
    "document_upload": "advanced",
    "ai_responses": "enhanced",
    "internet_search": true,
    "case_summarizer": true,
    "citation_generator": true,
    "export_formats": ["txt", "pdf", "docx"],
    "support": "email"
  }',
  15000,
  'monthly',
  100,
  500,
  true,
  true,
  false
),
(
  gen_random_uuid(),
  'Enterprise Plan',
  'enterprise',
  '{
    "chat_sessions": "unlimited",
    "document_upload": "enterprise",
    "ai_responses": "premium",
    "internet_search": true,
    "case_summarizer": true,
    "citation_generator": true,
    "precedent_tracking": true,
    "team_collaboration": true,
    "white_label": true,
    "analytics_dashboard": true,
    "export_formats": ["txt", "pdf", "docx"],
    "support": "priority"
  }',
  50000,
  'monthly',
  -1,
  -1,
  true,
  true,
  true
);

-- Insert sample legal documents
INSERT INTO documents (id, title, description, type, content, metadata, jurisdiction, year, citation, tags, is_public) VALUES
(
  gen_random_uuid(),
  'Constitution of the Federal Republic of Nigeria 1999 - Chapter IV',
  'Fundamental Rights provisions under the Nigerian Constitution',
  'statute',
  'CHAPTER IV - FUNDAMENTAL RIGHTS

36. (1) In the determination of his civil rights and obligations, including any question or determination by or against any government or authority, a person shall be entitled to a fair hearing within a reasonable time by a court or other tribunal established by law and constituted in such manner as to secure its independence and impartiality.

(2) Without prejudice to the foregoing provisions of this section, every person shall be entitled to be heard before he is condemned.

(3) The proceedings of a court or the proceedings of any tribunal relating to the matters mentioned in subsection (1) of this section (including the announcement of the decisions of the court or tribunal) shall be held in public.

37. The privacy of citizens, their homes, correspondence, telephone conversations and telegraphic communications is hereby guaranteed and protected.

38. (1) Every person shall be entitled to freedom of thought, conscience and religion, including freedom to change his religion or belief, and freedom (either alone or in community with others, and in public or in private) to manifest and propagate his religion or belief in worship, teaching, practice and observance.',
  '{
    "chapter": "IV",
    "sections": ["36", "37", "38"],
    "topics": ["fair hearing", "privacy", "freedom of religion"]
  }',
  'Nigeria',
  1999,
  '1999 Constitution, Chapter IV',
  ARRAY['constitution', 'fundamental rights', 'fair hearing', 'privacy', 'religion'],
  true
),
(
  gen_random_uuid(),
  'Okonkwo v. Attorney General of Anambra State',
  'Landmark case on fundamental rights and fair hearing',
  'case',
  'SUPREME COURT OF NIGERIA

Okonkwo v. Attorney General of Anambra State (2007) LPELR-1234(SC)

FACTS:
The appellant challenged the compulsory acquisition of his land by the Anambra State Government without adequate compensation and proper notice.

ISSUES:
1. Whether the compulsory acquisition was done in accordance with the Land Use Act
2. Whether the appellant was given fair hearing before the acquisition
3. Whether the compensation offered was adequate

HELD:
The Supreme Court held that:
1. Compulsory acquisition must follow due process under the Land Use Act
2. Fair hearing is a constitutional requirement that cannot be waived
3. Compensation must reflect the market value of the property

RATIO:
No person shall be deprived of his property without due process of law and adequate compensation.',
  '{
    "court": "Supreme Court",
    "year": 2007,
    "citation_number": "LPELR-1234(SC)",
    "legal_principles": ["due process", "fair hearing", "adequate compensation"]
  }',
  'Nigeria',
  2007,
  '(2007) LPELR-1234(SC)',
  ARRAY['land law', 'constitutional law', 'fair hearing', 'compensation'],
  true
),
(
  gen_random_uuid(),
  'Companies and Allied Matters Act 2020 - Part A',
  'Company incorporation and registration provisions',
  'statute',
  'PART A - INCORPORATION OF COMPANIES

18. (1) Any two or more persons may form and incorporate a company by complying with the requirements of this Act in respect of registration.

(2) A company may be formed for any lawful purpose.

(3) A company incorporated under this Act shall be a body corporate with perpetual succession and a common seal.

19. (1) No company shall be registered by a name which in the opinion of the Commission—
(a) is undesirable;
(b) is identical with that of any other existing company or business name; or
(c) so nearly resembles that name as to be calculated to deceive.

20. (1) The memorandum of association of a company shall state—
(a) the name of the company with "Limited" as the last word of the name in the case of a company limited by shares or by guarantee;
(b) the objects of the company;
(c) that the liability of the members is limited;
(d) the amount of share capital with which the company proposes to be registered and the division thereof into shares of a fixed amount.',
  '{
    "part": "A",
    "sections": ["18", "19", "20"],
    "topics": ["incorporation", "company names", "memorandum"]
  }',
  'Nigeria',
  2020,
  'CAMA 2020, Part A',
  ARRAY['company law', 'incorporation', 'CAMA', 'business registration'],
  true
);

-- Insert admin notifications
INSERT INTO admin_notifications (title, message, type, target_roles, is_active) VALUES
(
  'Welcome to easyAI',
  'Welcome to easyAI - your AI-powered legal research assistant. Start by uploading legal documents or asking questions about Nigerian law.',
  'info',
  ARRAY['user'],
  true
),
(
  'System Maintenance',
  'Scheduled maintenance will occur on Sundays from 2:00 AM to 4:00 AM WAT. Some features may be temporarily unavailable.',
  'warning',
  ARRAY['user', 'admin'],
  true
);

-- Note: Admin user will be created through the application signup process
-- The first user to sign up with an admin email can be promoted to super_admin role