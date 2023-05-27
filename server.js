const express = require('express');
const axios = require('axios');
const path = require('path');
const { Pool } = require('pg');

const app = express();

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'quadb',
  password: 'sql@2002',
  port: 5432
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Error connecting to PostgreSQL database:', err);
});

app.get('/data', async (req, res) => {
  try {
    const response = await axios.get('https://api.wazirx.com/api/v2/tickers');
    const tickersData = response.data;
    const top10Data = Object.entries(tickersData).slice(0, 10);

    let avg = 0;

    const reqData = top10Data.map(([symbol, data]) => {
      const { name, last, buy, sell, volume, base_unit } = data;
      avg = avg + parseInt(last);
      return { symbol, name, last, buy, sell, volume, base_unit };
    });
    avg = Math.floor(avg / 10);

    // Save the data to PostgreSQL
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS ticker_data (
        id SERIAL PRIMARY KEY,
        symbol TEXT,
        name TEXT,
        last TEXT,
        buy TEXT,
        sell TEXT,
        volume TEXT,
        base_unit TEXT
      )
    `);

    for (const row of reqData) {
      await client.query(`
        INSERT INTO ticker_data (symbol, name, last, buy, sell, volume, base_unit)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [row.symbol, row.name, row.last, row.buy, row.sell, row.volume, row.base_unit]);
    }

    await client.release();

    console.log('Data saved to database'); // Log message when data is saved
    res.send('Data Saved to Database Successfully');
  } catch (error) {
    console.error('Error fetching tickers data:', error);
    res.status(500).json({ error: 'Failed to fetch tickers data' });
  }
});


app.get('/fetchData', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM ticker_data LIMIT 10');
    const fetchedData = result.rows.map(row => ({
      symbol: row.symbol,
      name: row.name,
      last: row.last,
      buy: row.buy,
      sell: row.sell,
      volume: row.volume,
      base_unit: row.base_unit
    }));

    // Calculate average
    let avg = 0;
    for (const row of fetchedData) {
      avg += parseInt(row.last);
    }
    avg = Math.floor(avg / fetchedData.length);

    await client.release();

    res.json({ reqData: fetchedData, avg });
  } catch (error) {
    console.error('Error fetching data from database:', error);
    res.status(500).json({ error: 'Failed to fetch data from database' });
  }
});


const staticPath = path.join(__dirname, '/public');
// app.use(express.static(staticPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});
