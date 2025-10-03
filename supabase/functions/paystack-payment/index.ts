import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface PaymentRequest {
  user_id: string;
  plan_id: string;
  amount: number; // Amount in kobo (Nigerian smallest currency unit)
  email: string;
  callback_url: string;
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

    const { user_id, plan_id, amount, email, callback_url }: PaymentRequest = await req.json();

    if (!user_id || !plan_id || !amount || !email) {
      return new Response("Missing required parameters", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Paystack secret key
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found');
    }

    // Generate unique reference
    const reference = `easyai_${user_id.slice(0, 8)}_${Date.now()}`;

    // Create transaction record
    // Store amount in Naira (convert from kobo: divide by 100)
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id,
        amount: amount / 100, // Convert from kobo to naira for storage
        currency: 'NGN',
        paystack_tx_ref: reference,
        status: 'pending',
        metadata: {
          plan_id,
          plan_name: plan.name,
          billing_cycle: plan.billing_cycle
        }
      })
      .select()
      .single();

    if (transactionError) {
      throw transactionError;
    }

    // Initialize Paystack payment
    // Paystack API expects amount in kobo (already received in kobo from frontend)
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amount, // Amount in kobo (e.g., 15000 Naira = 1500000 kobo)
        reference,
        callback_url,
        metadata: {
          user_id,
          plan_id,
          transaction_id: transaction.id,
          plan_name: plan.name
        },
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
        split_code: plan.split_account || undefined
      })
    });

    if (!paystackResponse.ok) {
      const errorData = await paystackResponse.json();
      throw new Error(`Paystack error: ${errorData.message}`);
    }

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      throw new Error(`Paystack initialization failed: ${paystackData.message}`);
    }

    // Update transaction with Paystack access code
    await supabase
      .from('transactions')
      .update({
        paystack_access_code: paystackData.data.access_code
      })
      .eq('id', transaction.id);

    return new Response(
      JSON.stringify({
        success: true,
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference
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
    console.error("Payment initialization error:", error);
    
    return new Response(
      JSON.stringify({
        error: "Failed to initialize payment",
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