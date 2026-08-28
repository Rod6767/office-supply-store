import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const event = req.body.data;

  // Listen for successful payment event
  if (event.attributes.type === 'checkout_session.payment.paid') {
    const checkoutSession = event.attributes.data;
    const checkoutId = checkoutSession.id;

    // Update order status in database
    const { error } = await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('paymongo_checkout_id', checkoutId);

    if (error) {
      console.error('Error updating order:', error);
      return res.status(500).send('Database Error');
    }
  }

  return res.status(200).json({ received: true });
}