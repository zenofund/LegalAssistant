import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VerifyPaymentRequest {
  reference: string;
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
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reference }: VerifyPaymentRequest = await req.json();

    if (!reference) {
      return new Response(JSON.stringify({ error: 'Missing payment reference' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
        },
      }
    );

    if (!paystackResponse.ok) {
      throw new Error('Failed to verify payment with Paystack');
    }

    const paystackData = await paystackResponse.json();

    if (!paystackData.status || paystackData.data.status !== 'success') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Payment verification failed',
          status: paystackData.data.status
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*, metadata')
      .eq('paystack_tx_ref', reference)
      .maybeSingle();

    if (txError) {
      throw txError;
    }

    if (!transaction) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Transaction not found'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (transaction.status === 'success') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payment already verified',
          alreadyProcessed: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        status: 'success',
        payment_method: paystackData.data.channel,
        metadata: {
          ...transaction.metadata,
          gateway_response: paystackData.data.gateway_response,
          paid_at: paystackData.data.paid_at,
        }
      })
      .eq('id', transaction.id);

    if (updateError) {
      throw updateError;
    }

    const planId = transaction.metadata?.plan_id;
    let activatedSubscriptionId = null;
    let activatedPlan = null;

    if (planId) {
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
        activatedPlan = plan;
        const startDate = new Date().toISOString();
        let endDate = null;

        if (plan.billing_cycle === 'monthly') {
          endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        } else if (plan.billing_cycle === 'yearly') {
          endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        }

        const { data: existingSubscription, error: subFetchError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (subFetchError) {
          console.error('Error fetching subscription:', subFetchError);
          throw subFetchError;
        }

        if (existingSubscription) {
          console.log('Updating existing subscription:', existingSubscription.id);

          const { data: updatedSub, error: updateSubError } = await supabase
            .from('subscriptions')
            .update({
              plan_id: plan.id,
              status: 'active',
              start_date: startDate,
              end_date: endDate,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingSubscription.id)
            .select()
            .single();

          if (updateSubError) {
            console.error('Error updating subscription:', updateSubError);
            throw updateSubError;
          }

          activatedSubscriptionId = updatedSub.id;
          console.log('Subscription updated successfully:', activatedSubscriptionId);
        } else {
          console.log('Creating new subscription for user:', user.id);

          const { data: newSub, error: insertSubError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: user.id,
              plan_id: plan.id,
              status: 'active',
              start_date: startDate,
              end_date: endDate,
            })
            .select()
            .single();

          if (insertSubError) {
            console.error('Error creating subscription:', insertSubError);
            throw insertSubError;
          }

          activatedSubscriptionId = newSub.id;
          console.log('Subscription created successfully:', activatedSubscriptionId);
        }

        console.log('Updating transaction with subscription_id:', activatedSubscriptionId);
        await supabase
          .from('transactions')
          .update({ subscription_id: activatedSubscriptionId })
          .eq('id', transaction.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment verified and subscription activated',
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          status: 'success'
        },
        subscription: activatedSubscriptionId ? {
          id: activatedSubscriptionId,
          plan: activatedPlan ? {
            name: activatedPlan.name,
            tier: activatedPlan.tier
          } : null
        } : null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Payment verification error:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to verify payment",
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
