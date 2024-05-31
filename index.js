const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());
















// server running test
app.get('/', (req, res) => {
    res.send('medical Camp server running ... on ', port)
})

app.listen(port, () => {
    console.log(`medical Camp server listening on port ${port}`)
})