require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const BASE = 'https://apiconnect.angelone.in';
let authToken = null;
let tokenExpiry = null;

function getHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    'X-ClientLocalIP': '127.0.0.1',
    'X-ClientPublicIP': '127.0.0.1',
    'X-MACAddress': '00:00:00:00:00:00',
    'X-PrivateKey': apiKey || process.env.ANGELONE_API_KEY,
    ...(authToken ? { 'Authorization': 'Bearer ' + authToken } : {})
  };
}

app.post('/api/login', async (req, res) => {
  const { clientcode, password, totp, apiKey } = req.body;
  if (!clientcode || !password || !totp) {
    return res.json({ success: false, error: 'Missing credentials' });
  }
  try {
    const key = apiKey || process.env.ANGELONE_API_KEY;
    const response = await axios.post(
      BASE + '/rest/auth/angelbroking/user/v1/loginByPassword',
      { clientcode, password, totp },
      { headers: getHeaders(key) }
    );
    if (response.data.status && response.data.data && response.data.data.jwtToken) {
      authToken = response.data.data.jwtToken;
      tokenExpiry = Date.now() + 3600000;
      console.log('Login successful:', clientcode);
      return res.json({ success: true, token: authToken });
    }
    return res.json({ success: false, error: response.data.message || 'Login failed' });
  } catch (e) {
    console.error('Login error:', e.message);
    return res.json({ success: false, error: e.message });
  }
});

app.post('/api/marketdata', async (req, res) => {
  if (!authToken) return res.json({ success: false, error: 'Not logged in' });
  try {
    const r = await axios.post(
      BASE + '/rest/secure/angelbroking/market/v1/quote/',
      req.body,
      { headers: getHeaders() }
    );
    return res.json({ success: true, data: r.data.data });
  } catch (e) {
    return res.json({ success: false, error: e.message });
  }
});

app.get('/api/candles/:token/:exchange/:interval', async (req, res) => {
  if (!authToken) return res.json({ success: false, error: 'Not logged in' });
  try {
    const { token, exchange, interval } = req.params;
    const toDate = new Date().toISOString().slice(0, 19);
    const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);
    const r = await axios.post(
      BASE + '/rest/secure/angelbroking/historical/v1/getCandleData',
      { exchange, symboltoken: token, interval: interval || 'ONE_DAY', fromdate: fromDate, todate: toDate },
      { headers: getHeaders() }
    );
    if (r.data.status && r.data.data) {
      return res.json({ success: true, data: r.data.data });
    }
    return res.json({ success: false, data: [] });
  } catch (e) {
    return res.json({ success: false, error: e.message, data: [] });
  }
});

app.get('/api/holdings', async (req, res) => {
  if (!authToken) return res.json({ success: false, error: 'Not logged in' });
  try {
    const r = await axios.get(
      BASE + '/rest/secure/angelbroking/portfolio/v1/getHolding',
      { headers: getHeaders() }
    );
    return res.json({ success: true, data: r.data.data || [] });
  } catch (e) {
    return res.json({ success: false, error: e.message });
  }
});

app.get('/api/positions', async (req, res) => {
  if (!authToken) return res.json({ success: false, error: 'Not logged in' });
  try {
    const r = await axios.get(
      BASE + '/rest/secure/angelbroking/order/v1/getPosition',
      { headers: getHeaders() }
    );
    return res.json({ success: true, data: r.data.data || [] });
  } catch (e) {
    return res.json({ success: false, error: e.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    running: true,
    loggedIn: !!authToken,
    tokenValid: tokenExpiry ? Date.now() < tokenExpiry : false,
    message: authToken ? 'Connected and authenticated' : 'Server running - login to activate live data'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('TradeAI backend running on port ' + PORT);
});
