async function runFullE2ETest() {
  console.log('================================================================');
  console.log('  DealFlow 360 Full End-to-End Microservice Verification Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`  ✓ [PASS] ${name} ${details ? `(${details})` : ''}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${name} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // 1. Gateway Health Check & Service Health Probes
  try {
    const healthRes = await fetch('http://localhost:3000/health');
    const healthData = await healthRes.json();
    assert('Gateway Health Check', healthRes.status === 200 && healthData.check === 'pass', `status=${healthRes.status}`);
  } catch (err) {
    assert('Gateway Health Check', false, err.message);
  }

  const microservices = ['auth', 'catalog', 'quotation', 'fulfillment', 'billing', 'analytics'];
  for (const svc of microservices) {
    try {
      const svcHealthRes = await fetch(`http://localhost:3000/health/${svc}`);
      assert(`Health Probe: [${svc}]`, svcHealthRes.status === 200, `status=${svcHealthRes.status}`);
    } catch (err) {
      assert(`Health Probe: [${svc}]`, false, err.message);
    }
  }

  // 2. Auth Service: Admin Login & JWT Issuance
  let adminToken = '';
  try {
    const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@dealflow360.com',
        password: 'AdminP@ss123'
      })
    });
    const loginData = await loginRes.json();
    adminToken = loginData.accessToken;
    assert('Auth Service Admin Login', loginRes.status === 200 && !!adminToken, `role=${loginData.user?.role}`);
  } catch (err) {
    assert('Auth Service Admin Login', false, err.message);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  // 3. Auth Service: User Directory & RBAC
  try {
    const usersRes = await fetch('http://localhost:3000/api/v1/auth/users', { headers: authHeaders });
    const usersData = await usersRes.json();
    const count = usersData.data?.length ?? (Array.isArray(usersData) ? usersData.length : 0);
    assert('Auth User Directory', usersRes.status === 200 && count > 0, `totalUsers=${count}`);
  } catch (err) {
    assert('Auth User Directory', false, err.message);
  }

  // 4. Catalog Service: Products & Categories
  let sampleProductId = '';
  try {
    const prodRes = await fetch('http://localhost:3000/api/v1/catalog/products', { headers: authHeaders });
    const prodData = await prodRes.json();
    const products = prodData.data || prodData;
    if (Array.isArray(products) && products.length > 0) {
      sampleProductId = products[0].id;
    }
    assert('Catalog Products Query', prodRes.status === 200 && Array.isArray(products), `productsFound=${products.length}`);
  } catch (err) {
    assert('Catalog Products Query', false, err.message);
  }

  // 5. Catalog Service: Categories
  try {
    const catRes = await fetch('http://localhost:3000/api/v1/catalog/categories', { headers: authHeaders });
    const catData = await catRes.json();
    const cats = catData.data || catData;
    assert('Catalog Categories Query', catRes.status === 200 && Array.isArray(cats), `categoriesCount=${cats.length}`);
  } catch (err) {
    assert('Catalog Categories Query', false, err.message);
  }

  // 6. Quotation Service: List Quotations
  let sampleQuoteId = '';
  try {
    const quoteRes = await fetch('http://localhost:3000/api/v1/quotations', { headers: authHeaders });
    const quoteData = await quoteRes.json();
    const quotes = quoteData.data || quoteData.quotations || quoteData;
    if (Array.isArray(quotes) && quotes.length > 0) {
      sampleQuoteId = quotes[0].id;
    }
    assert('Quotation Service List', quoteRes.status === 200 && Array.isArray(quotes), `quotesFound=${quotes.length}`);
  } catch (err) {
    assert('Quotation Service List', false, err.message);
  }

  // 7. Quotation Service: Customer Directory & Create Draft Quotation
  let customerId = '';
  try {
    const custRes = await fetch('http://localhost:3000/api/v1/quotations/customers', { headers: authHeaders });
    const custData = await custRes.json();
    const customers = custData.data || custData.items || custData;
    if (Array.isArray(customers) && customers.length > 0) {
      customerId = customers[0].id;
    } else {
      const createCustRes = await fetch('http://localhost:3000/api/v1/quotations/customers', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Nexus Corp Global',
          email: `procurement_${Date.now()}@nexus.io`,
          tier: 'GOLD',
          currency: 'INR',
          hasPortalAccess: true
        })
      });
      const createdCust = await createCustRes.json();
      customerId = createdCust.id;
    }
    assert('Quotation Customers Query/Create', !!customerId, `customerId=${customerId}`);

    // Create Draft Quotation
    const createQuoteRes = await fetch('http://localhost:3000/api/v1/quotations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        customerId: customerId,
        currency: 'INR',
        notes: 'E2E automated validation quote'
      })
    });
    const createdQuote = await createQuoteRes.json();
    const createdId = createdQuote.id || createdQuote.data?.id;
    assert('Quotation Service Create Draft', createQuoteRes.status === 200 || createQuoteRes.status === 201, `createdId=${createdId}`);
  } catch (err) {
    assert('Quotation Service Create Draft', false, err.message);
  }

  // 8. Analytics Service: Dashboard KPIs
  try {
    const analyticsRes = await fetch('http://localhost:3000/api/v1/analytics/dashboard', { headers: authHeaders });
    const analyticsData = await analyticsRes.json();
    assert('Analytics Dashboard KPIs', analyticsRes.status === 200, `activePipeline=${analyticsData.kpis?.activePipeline ?? 'calculated'}`);
  } catch (err) {
    assert('Analytics Dashboard KPIs', false, err.message);
  }

  // 9. Analytics Service: Deal Health Exceptions
  try {
    const healthAlertsRes = await fetch('http://localhost:3000/api/v1/analytics/deal-health', { headers: authHeaders });
    const healthAlertsData = await healthAlertsRes.json();
    assert('Analytics Deal Health Alerts', healthAlertsRes.status === 200, `alertsCount=${healthAlertsData.alerts?.length ?? healthAlertsData.length ?? 0}`);
  } catch (err) {
    assert('Analytics Deal Health Alerts', false, err.message);
  }

  // 10. Customer Portal: Portal Token / Session Proxy Route Check
  try {
    const portalQuoteRes = await fetch('http://localhost:3000/portal/v1/quotations/test-token', {
      headers: { 'Content-Type': 'application/json' }
    });
    assert('Customer Portal Gateway Proxy Route', portalQuoteRes.status < 500, `portalStatus=${portalQuoteRes.status}`);
  } catch (err) {
    assert('Customer Portal Gateway Proxy Route', false, err.message);
  }

  console.log('\n================================================================');
  console.log(`  E2E Integration Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runFullE2ETest().catch(err => {
  console.error('Fatal Test Execution Error:', err);
  process.exit(1);
});
