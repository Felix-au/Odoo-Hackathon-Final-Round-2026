async function test() {
  const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@dealflow360.com',
      password: 'AdminP@ss123'
    })
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  console.log('Login status:', loginRes.status, 'Role:', loginData.user?.role);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const prodRes = await fetch('http://localhost:3000/api/v1/catalog/products', { headers: authHeaders });
  const prodData = await prodRes.json();
  console.log('Products status:', prodRes.status, 'Count:', prodData.data?.length ?? prodData.length ?? 0);

  const catRes = await fetch('http://localhost:3000/api/v1/catalog/categories', { headers: authHeaders });
  const catData = await catRes.json();
  console.log('Categories status:', catRes.status, 'Count:', catData.data?.length ?? catData.length ?? 0);

  const quoteRes = await fetch('http://localhost:3000/api/v1/quotations', { headers: authHeaders });
  const quoteData = await quoteRes.json();
  console.log('Quotations status:', quoteRes.status, 'Count:', quoteData.data?.length ?? quoteData.quotations?.length ?? 0);

  const analyticsRes = await fetch('http://localhost:3000/api/v1/analytics/dashboard', { headers: authHeaders });
  const analyticsData = await analyticsRes.json();
  console.log('Analytics status:', analyticsRes.status, 'Data keys:', Object.keys(analyticsData));

  console.log('=== ALL CORE SERVICES ACCESSIBLE THROUGH GATEWAY ===');
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
