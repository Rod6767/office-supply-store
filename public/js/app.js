const SUPABASE_URL = "https://kovnkxhcdofeoifoxqcw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lesnR5TJ_bPUatly4ohicg_iQIRpHTr";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;

// Routing Control
function showPage(pageId) {
  ['home', 'store', 'dashboard', 'about', 'contacts'].forEach(id => {
    document.getElementById(`page-${id}`).style.display = id === pageId ? 'block' : 'none';
  });
  if(pageId === 'store' || pageId === 'home') fetchProducts();
  if(pageId === 'dashboard') loadDashboard();
}

// Modal Control
function openAuthModal() { document.getElementById('auth-modal').style.display = 'flex'; }
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }

// Auth Handler
document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const fullName = document.getElementById('auth-name').value;
  const gcash = document.getElementById('auth-gcash').value;
  const role = document.getElementById('auth-role').value;

  // Try Sign In
  let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  // If User Not Found, Try Sign Up
  if (error) {
    const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({ email, password });
    if (signUpError) return alert(signUpError.message);
    
    // Save User Profile Data
    await supabaseClient.from('profiles').insert([{
      id: signUpData.user.id,
      full_name: fullName,
      gcash_number: gcash,
      role: role
    }]);
    alert('Registration successful!');
    data = { user: signUpData.user };
  }
  
  currentUser = data.user;
  closeAuthModal();
  updateAuthUI();
});

async function updateAuthUI() {
  const session = (await supabaseClient.auth.getSession()).data.session;
  if (session) {
    currentUser = session.user;
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    currentProfile = data;
    document.getElementById('nav-auth').style.display = 'none';
    document.getElementById('nav-dashboard').style.display = 'inline';
    document.getElementById('nav-logout').style.display = 'inline';
  } else {
    document.getElementById('nav-auth').style.display = 'inline';
    document.getElementById('nav-dashboard').style.display = 'none';
    document.getElementById('nav-logout').style.display = 'none';
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  currentProfile = null;
  updateAuthUI();
  showPage('home');
}

// Product Fetching & Reviews Display
async function fetchProducts() {
  const { data: products } = await supabaseClient.from('products').select('*');
  if (!products) return;
  const renderContainer = (containerId) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = products.map(p => `
      <div class="card">
        <img src="${p.image_url}" alt="${p.title}">
        <h3>${p.title}</h3>
        <p>${p.description}</p>
        <div class="price">₱${p.price}</div>
        <button class="btn-cta" onclick="initiatePayment(${p.price}, '${p.title}', '${p.id}', '${p.seller_id}')">Buy with GCash</button>
        <div style="margin-top:10px;">
          <small>Leave Review:</small>
          <select id="rating-${p.id}">
            <option value="5">★★★★★ (5)</option>
            <option value="4">★★★★☆ (4)</option>
            <option value="3">★★★☆☆ (3)</option>
          </select>
          <input type="text" id="review-${p.id}" placeholder="Write comment...">
          <button onclick="submitReview('${p.id}')">Submit</button>
        </div>
      </div>
    `).join('');
  };
  renderContainer('featured-products');
  renderContainer('all-products');
}

// Payment trigger via backend endpoint
async function initiatePayment(amount, title, productId, sellerId) {
  if(!currentUser) return openAuthModal();

  const res = await fetch('/api/paymongo-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amount,
      description: title,
      buyerEmail: currentUser.email,
      successUrl: window.location.href,
      cancelUrl: window.location.href
    })
  });

  const data = await res.json();
  if(data.checkoutUrl) {
    // Record Order in Supabase as Pending
    await supabaseClient.from('orders').insert([{
      buyer_id: currentUser.id,
      seller_id: sellerId,
      product_id: productId,
      amount: amount,
      paymongo_checkout_id: data.id,
      status: 'pending'
    }]);

    window.location.href = data.checkoutUrl;
  }
}

// Post Product
document.getElementById('add-product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await supabaseClient.from('products').insert([{
    seller_id: currentUser.id,
    title: document.getElementById('prod-title').value,
    description: document.getElementById('prod-desc').value,
    price: document.getElementById('prod-price').value,
    image_url: document.getElementById('prod-image').value
  }]);
  alert('Product listed successfully!');
  fetchProducts();
});

// Submit Reviews
async function submitReview(productId) {
  if(!currentUser) return openAuthModal();
  const rating = document.getElementById(`rating-${productId}`).value;
  const comment = document.getElementById(`review-${productId}`).value;

  await supabaseClient.from('reviews').insert([{
    product_id: productId,
    buyer_id: currentUser.id,
    rating: parseInt(rating),
    comment: comment
  }]);
  alert('Review Submitted!');
}

// Load Dashboard Data
async function loadDashboard() {
  if(!currentProfile) return;
  if(currentProfile.role === 'seller') {
    document.getElementById('seller-section').style.display = 'block';
    const { data } = await supabaseClient.from('orders').select('*, products(title)').eq('seller_id', currentUser.id);
    if (data) {
      document.getElementById('sales-history').innerHTML = data.map(o => `<p>Product: ${o.products?.title} | Amount: ₱${o.amount} | Status: ${o.status}</p>`).join('');
    }
  } else {
    document.getElementById('buyer-section').style.display = 'block';
    const { data } = await supabaseClient.from('orders').select('*, products(title)').eq('buyer_id', currentUser.id);
    if (data) {
      document.getElementById('purchase-history').innerHTML = data.map(o => `<p>Product: ${o.products?.title} | Amount: ₱${o.amount} | Status: ${o.status}</p>`).join('');
    }
  }
}

// Initialize System
updateAuthUI();
fetchProducts();
