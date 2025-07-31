const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');

const app = express();
const port = 3000;

// Cung cấp tệp tĩnh từ thư mục 'public'
app.use(express.static(path.resolve(__dirname, 'public')));

// Route trang chủ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Khởi động server
app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});
