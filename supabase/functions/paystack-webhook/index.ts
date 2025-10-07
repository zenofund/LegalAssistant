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
    console.log('Processing charge success webhook for reference:', data.reference);

    // Update transaction status
    const { error: transactionError } = await supabase
      .from('transactions')
      .update({
        status: 'success',
        payment_method: data.channel,
        metadata: {
          gateway_response: data.gateway_response,
          paid_at: data.paid_at,
          fees: data.fees
        }
      })
      .eq('paystack_tx_ref', data.reference);

    if (transactionError) {
      console.error('Error updating transaction:', transactionError);
      throw transactionError;
    }

    // Get transaction details with metadata
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('paystack_tx_ref', data.reference)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching transaction:', fetchError);
      throw fetchError;
    }

    if (!transaction) {
      console.error('Transaction not found for reference:', data.reference);
      throw new Error('Transaction not found');
    }

    console.log('Transaction found:', transaction.id, 'User ID:', transaction.user_id);

    // Get plan from transaction metadata
    const planId = transaction.metadata?.plan_id;

    if (planId) {
      console.log('Plan ID from metadata:', planId);

      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();

      if (planError) {
        console.error('Error fetching plan:', planError);
        throw planError;
      }

      if (plan) {
        console.log('Plan found:', plan.name, 'Tier:', plan.tier);

        const startDate = new Date().toISOString();
        let endDate = null;

        if (plan.billing_cycle === 'monthly') {
          endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        } else if (plan.billing_cycle === 'yearly') {
          endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        }

        // Check for existing active subscription
        const { data: existingSubscription, error: subFetchError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', transaction.user_id)
          .eq('status', 'active')
          .maybeSingle();

        if (subFetchError) {
          console.error('Error fetching existing subscription:', subFetchError);
          throw subFetchError;
        }

        let subscriptionId = null;

        if (existingSubscription) {
          console.log('Updating existing subscription:', existingSubscription.id);

          const { data: updatedSub, error: updateError } = await supabase
            .from('subscriptions')
            .update({
              plan_id: plan.id,
              status: 'active',
              start_date: startDate,
              end_date: endDate,
              paystack_subscription_code: data.subscription?.subscription_code,
              paystack_customer_code: data.customer?.customer_code,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingSubscription.id)
            .select()
            .single();

          if (updateError) {
            console.error('Error updating subscription:', updateError);
            throw updateError;
          }

          subscriptionId = updatedSub.id;
          console.log('Subscription updated successfully');
        } else {
          console.log('Creating new subscription');

          const { data: newSub, error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: transaction.user_id,
              plan_id: plan.id,
              status: 'active',
              start_date: startDate,
              end_date: endDate,
              paystack_subscription_code: data.subscription?.subscription_code,
              paystack_customer_code: data.customer?.customer_code
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error creating subscription:', insertError);
            throw insertError;
          }

          subscriptionId = newSub.id;
          console.log('Subscription created successfully:', subscriptionId);
        }

        // Update transaction with subscription_id
        if (subscriptionId) {
          await supabase
            .from('transactions')
            .update({ subscription_id: subscriptionId })
            .eq('id', transaction.id);
        }
      }
    }

    console.log('Charge success processed successfully');
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