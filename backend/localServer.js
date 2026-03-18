// localServer.js — only used for local development
// Vercel uses server.js directly (no listen needed there)
require('dotenv').config();
const app  = require('./server');
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅  Backend running locally on http://localhost:${PORT}`);
  console.log(`🗄️   Connected to Supabase PostgreSQL`);
});
