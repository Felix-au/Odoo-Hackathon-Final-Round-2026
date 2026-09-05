const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, raw: d }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, raw: d }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== TEST ALL SERVICES VIA API GATEWAY (PORT 3000) ===\n');

  console.log('1. Gateway Health Probe');
  const gwHealth = await get('/health');
  console.log('   Status:', gwHealth.status, gwHealth.data);

  console.log('\n2. Services Health Probes via Gateway');
  for (const svc of ['auth', 'catalog', 'quotation', 'fulfillment', 'billing', 'analytics']) {
    const h = await get(`/health/${svc}`);
    console.log(`   [${svc.toUpperCase()}] Status:`, h.status, h.data?.status || h.data?.service);
  }

  console.log('\n3. Auth Login via Gateway (POST /api/v1/auth/login)');
  const login = await post('/api/v1/auth/login', {
    email: 'admin@dealflow360.com',
    password: 'AdminP@ss123'
  });
  console.log('   Status:', login.status, 'Token received:', login.data?.accessToken ? 'YES' : 'NO');
  const token = login.data?.accessToken;

  console.log('\n4. Auth Users via Gateway (GET /api/v1/auth/users)');
  const users = await get('/api/v1/auth/users', token);
  console.log('   Status:', users.status, 'Users count:', users.data?.data?.length || users.data?.users?.length);

  console.log('\n5. Catalog Products via Gateway (GET /api/v1/catalog/products)');
  const products = await get('/api/v1/catalog/products', token);
  console.log('   Status:', products.status, 'Products count:', products.data?.data?.length || products.data?.products?.length);

  console.log('\n6. Quotations via Gateway (GET /api/v1/quotations)');
  const quotations = await get('/api/v1/quotations', token);
  console.log('   Status:', quotations.status, 'Quotations count:', quotations.data?.quotations?.length || quotations.data?.length);

  console.log('\n7. Fulfillment Split via Gateway (GET /api/v1/fulfillment/split-recommendation?orderId=q-001)');
  const split = await get('/api/v1/fulfillment/split-recommendation?orderId=q-001', token);
  console.log('   Status:', split.status, 'Splits count:', split.data?.splits?.length);

  console.log('\n8. Billing Invoices via Gateway (GET /api/v1/billing/invoices)');
  const invoices = await get('/api/v1/billing/invoices', token);
  console.log('   Status:', invoices.status, 'Invoices count:', invoices.data?.invoices?.length || invoices.data?.total);

  console.log('\n9. Analytics Dashboard via Gateway (GET /api/v1/analytics/dashboard)');
  const analytics = await get('/api/v1/analytics/dashboard', token);
  console.log('   Status:', analytics.status, 'Total Revenue:', analytics.data?.kpis?.totalRevenue);

  console.log('\n=== ALL GATEWAY REQUESTS COMPLETED SUCCESSFULLY ===');
}

main().catch(console.error);
