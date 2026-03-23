import axios from 'axios';

const apiBaseUrl = process.env.LOAD_TEST_API_BASE_URL || process.env.API_BASE_URL || 'http://127.0.0.1:4000';
const prefix = String(process.env.LOAD_TEST_PREFIX || 'load100')
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, '') || 'load100';
const password = String(process.env.LOAD_TEST_PASSWORD || 'LoadTest#123456');
const adminEmail = `${prefix}.u0001@laines.ufrn.br`;

const http = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000
});

const main = async () => {
  const login = await http.post('/auth/login', {
    email: adminEmail,
    password
  });
  const token = String(login?.data?.accessToken || '');
  if (!token) {
    throw new Error('Token vazio no reset de observabilidade.');
  }

  const response = await http.post(
    '/observability/reset',
    {},
    { headers: { authorization: `Bearer ${token}` } }
  );
  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Falha no reset observability: status ${response.status}`);
  }

  console.log(`[reset-observability] ok (${adminEmail})`);
};

main().catch((error) => {
  console.error(`[reset-observability] failed: ${error?.message || 'unknown error'}`);
  process.exitCode = 1;
});
