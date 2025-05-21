// pdf-server/server.js
const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs/promises');
const cors = require('cors'); // You'll need to install this: npm install cors

const app = express();
const port = 3000;

app.use(cors()); // Enable CORS for cross-origin requests from your frontend
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.post('/generate-pdf', async (req, res) => {
    const text = req.body.text;

    if (!text) {
        return res.status(400).json({ error: 'Text content is required.' });
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        const templatePath = path.join(__dirname, 'public', 'print-template.html');
        let htmlContent = await fs.readFile(templatePath, 'utf8');

        // Inject the text into the content div
        htmlContent = htmlContent.replace('<div class="content"></div>', `<div class="content">${text}</div>`);

        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        // Give a little extra time for fonts to render, adjust if needed
        await new Promise(r => setTimeout(r, 500));

        const pdfBuffer = await page.pdf({
            width: '89mm',
            height: '89mm',
            printBackground: true,
            pageRanges: '1',
            margin: {
                top: '0',
                right: '0',
                bottom: '0',
                left: '0'
            }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="dedication.pdf"');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF.' });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});