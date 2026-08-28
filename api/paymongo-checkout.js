import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, description, buyerEmail, successUrl, cancelUrl } = req.body;

  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}`
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: Math.round(amount * 100), // Convert PHP to Centavos
          payment_method_types: ['gcash'],
          description: description,
          send_email_receipt: true,
          show_description: true,
          line_items: [
            {
              currency: 'PHP',
              amount: Math.round(amount * 100),
              description: description,
              name: 'Office Supply Purchase',
              quantity: 1
            }
          ],
          success_url: successUrl,
          cancel_url: cancelUrl
        }
      }
    })
  };

  try {
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', options);
    const data = await response.json();
    if (data.errors) return res.status(400).json({ error: data.errors });
    return res.status(200).json({ checkoutUrl: data.data.attributes.checkout_url, id: data.data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}