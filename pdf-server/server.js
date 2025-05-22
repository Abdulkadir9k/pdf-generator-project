// pdf-server/server.js
const express = require("express");
const puppeteer = require('puppeteer-core'); // Already correct: Use puppeteer-core
const chromium = require('@sparticuz/chromium'); // Already correct: Import chromium
const path = require("path");
const fs = require("fs/promises");
const cors = require("cors");

const app = express();
// CHANGE THIS: Use process.env.PORT for Render deployment, fallback to 3000 for local
const port = process.env.PORT || 3000;

app.use(cors()); // Enable CORS for cross-origin requests from your frontend
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

app.post("/generate-pdf", async (req, res) => {
  const text = req.body.text;

  if (!text) {
    return res.status(400).json({ error: "Text content is required." });
  }

  let browser;
  try {
    // UPDATED SECTION: Configure puppeteer.launch to use @sparticuz/chromium
    browser = await puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'], // Use chromium's recommended args and add specific ones
      defaultViewport: chromium.defaultViewport, // Use chromium's recommended viewport
      executablePath: await chromium.executablePath(), // Get the executable path from @sparticuz/chromium
      headless: chromium.headless, // Use chromium's headless setting (true by default for @sparticuz/chromium)
      ignoreHTTPSErrors: true, // Good practice for some environments
    });
    const page = await browser.newPage();

    const templatePath = path.join(__dirname, "public", "print-template.html");
    let htmlContent = await fs.readFile(templatePath, "utf8");

    // --- NEW / MODIFIED SECTION FOR CSS INJECTION ---
    const stylesPath = path.join(__dirname, "public", "styles.css"); // Path to your styles.css
    const cssContent = await fs.readFile(stylesPath, 'utf8'); // Read styles.css content

    // Replace the <link> tag with a <style> block containing the actual CSS content
    htmlContent = htmlContent.replace(
        '<link rel="stylesheet" href="/styles.css">', // This is the line in print-template.html
        `<style>${cssContent}</style>`
    );
    // --- END NEW / MODIFIED SECTION ---

    // Inject the text into the content div
    htmlContent = htmlContent.replace(
      '<div class="content"></div>',
      `<div class="content">${text}</div>`
    );

    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    // Give a little extra time for fonts to render, adjust if needed
    await new Promise((r) => setTimeout(r, 500));

    const pdfBuffer = await page.pdf({
      width: "89mm",
      height: "89mm",
      printBackground: true,
      pageRanges: "1",
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="dedication.pdf"'
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF.", details: error.message }); // Added .details for better error reporting
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});