const http = require('http');

async function main() {
  const req = http.request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Status Gateway 127.0.0.1:3000 (/api/v1/auth/login):', res.statusCode);
      try {
        const json = JSON.parse(data);
        console.log('Access token received:', json.accessToken ? 'YES' : 'NO');
        console.log('User email:', json.user?.email);
      } catch (e) {
        console.log('Body:', data);
      }
    });
  });
  req.on('error', (err) => console.error('Error on Gateway 127.0.0.1:3000:', err.message));
  req.write(JSON.stringify({ email: 'admin@dealflow360.com', password: 'AdminP@ss123' }));
  req.end();
}

main();
