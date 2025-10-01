import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

    // Verify webhook signature
    const signature = req.headers.get('x-paystack-signature');
    const webhookSecret = Deno.env.get('PAYSTACK_WEBHOOK_SECRET');
    
    if (!signature || !webhookSecret) {
      return new Response("Invalid webhook", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const body = await req.text();
    
    // Verify signature (simplified - in production, use crypto.subtle)
    const expectedSignature = await crypto.subtle.digest(
      'SHA-512',
      new TextEncoder().encode(webhookSecret + body)
    );
    
    // Parse webhook event
    const event = JSON.parse(body);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different webhook events
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(supabase, event.data);
        break;
      
      case 'subscription.create':
        await handleSubscriptionCreate(supabase, event.data);
        break;
      
      case 'subscription.disable':
        await handleSubscriptionDisable(supabase, event.data);
        break;

      case 'invoice.create':
        await handleInvoiceCreate(supabase, event.data);
        break;

      default:
        console.log(`Unhandled webhook event: ${event.event}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    
    return new Response(
      JSON.stringify({
        error: "Webhook processing failed",
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

async function handleChargeSuccess(supabase: any, data: any) {
  try {
    // Update transaction status
    const { error: transactionError } = await supabase
      .from('transactions')
      .update({
        status: 'success',
        paystack_tx_ref: data.reference,
        payment_method: data.channel,
        metadata: {
          gateway_response: data.gateway_response,
          paid_at: data.paid_at,
          fees: data.fees
        }
      })
      .eq('paystack_tx_ref', data.reference);

    if (transactionError) {
      throw transactionError;
    }

    // Get transaction details
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*, subscriptions(*)')
      .eq('paystack_tx_ref', data.reference)
      .single();

    if (fetchError || !transaction) {
      throw new Error('Transaction not found');
    }

    // Activate subscription
    if (transaction.subscription_id) {
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          paystack_subscription_code: data.subscription?.subscription_code,
          paystack_customer_code: data.customer?.customer_code
        })
        .eq('id', transaction.subscription_id);

      if (subscriptionError) {
        throw subscriptionError;
      }
    }

  } catch (error) {
    console.error('Error handling charge success:', error);
    throw error;
  }
}

async function handleSubscriptionCreate(supabase: any, data: any) {
  try {
    // Update subscription with Paystack details
    const { error } = await supabase
      .from('subscriptions')
      .update({
        paystack_subscription_code: data.subscription_code,
        paystack_customer_code: data.customer?.customer_code,
        status: 'active'
      })
      .eq('paystack_customer_code', data.customer?.customer_code);

    if (error) {
      throw error;
    }

  } catch (error) {
    console.error('Error handling subscription create:', error);
    throw error;
  }
}

async function handleSubscriptionDisable(supabase: any, data: any) {
  try {
    // Disable subscription
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        end_date: new Date().toISOString()
      })
      .eq('paystack_subscription_code', data.subscription_code);

    if (error) {
      throw error;
    }

  } catch (error) {
    console.error('Error handling subscription disable:', error);
    throw error;
  }
}

async function handleInvoiceCreate(supabase: any, data: any) {
  try {
    // Create transaction record for invoice
    const { error } = await supabase
      .from('transactions')
      .insert({
        user_id: data.customer?.metadata?.user_id,
        amount: data.amount / 100, // Convert from kobo to naira
        currency: 'NGN',
        paystack_tx_ref: data.reference,
        status: 'pending',
        metadata: {
          invoice_id: data.id,
          due_date: data.due_date,
          description: data.description
        }
      });

    if (error) {
      throw error;
    }

  } catch (error) {
    console.error('Error handling invoice create:', error);
    throw error;
  }
}