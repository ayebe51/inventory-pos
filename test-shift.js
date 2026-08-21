async function testOpenShift() {
  try {
    const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'Admin@123456' })
    });
    const loginData = await loginRes.json();
    console.log('Login Response:', loginData);
  } catch (error) {
    console.error('Error:', error.message);
  }
}
testOpenShift();
