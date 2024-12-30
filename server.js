const express = require('express');
const puppeteer = require('puppeteer-core');
const cors = require('cors');
const chromium = require('chrome-aws-lambda'); // Use chrome-aws-lambda for Render

const app = express();
const PORT = 4000;

// Use CORS middleware to allow requests from the frontend
app.use(
  cors({
    origin: 'http://localhost:3000', // Replace with your frontend's URL
  })
);

// Custom delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to scrape Google Scholar
async function scrapeGoogleScholar() {
  const url = "https://scholar.google.co.in/citations?user=aWWJczwAAAAJ&hl=en";

  // Launching Puppeteer with chromium configuration
  const browser = await puppeteer.launch({
    headless: true,
    args: chromium.args,
    executablePath: await chromium.executablePath,
    userDataDir: '/tmp/user_data', // Ensures clean session for each invocation
  });

  const page = await browser.newPage();

  await page.goto(url);
  await page.waitForSelector('.gsc_a_tr');

  let publications = [];
  let previousLength = 0;

  const scrapePublications = async () => {
    return await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.gsc_a_tr'));
      return rows.map((row) => ({
        title: row.querySelector('.gsc_a_at')?.innerText || "",
        authors: row.querySelector('.gsc_a_at + div')?.innerText || "",
        year: row.querySelector('.gsc_a_y')?.innerText || "",
        "Published in": row.querySelector('.gsc_a_at + div + div')?.innerText || "", // Updated key name
        link: row.querySelector('.gsc_a_at')?.href || "",
      }));
    });
  };

  publications = await scrapePublications();

  let showMoreButtonVisible = await page.$('#gsc_bpf_more');

  while (showMoreButtonVisible) {
    console.log("Clicking 'Show More' button...");
    await page.click('#gsc_bpf_more');
    await delay(2000);

    const newPublications = await scrapePublications();

    newPublications.forEach((pub) => {
      if (!publications.some((existing) => existing.title === pub.title && existing.link === pub.link)) {
        publications.push(pub);
      }
    });

    console.log(`Scraped so far: ${publications.length}`);

    if (publications.length === previousLength) {
      console.log("No new publications found, stopping...");
      break;
    }

    previousLength = publications.length;
    showMoreButtonVisible = await page.$('#gsc_bpf_more');
  }

  console.log(`Total publications scraped: ${publications.length}`);
  await browser.close();
  return publications;
}

// API route to fetch publications
app.get('/publications', async (req, res) => {
  try {
    console.log('Fetching publications...');
    const publications = await scrapeGoogleScholar();
    res.json(publications);
  } catch (error) {
    console.error("Error scraping Google Scholar:", error);
    res.status(500).send("Error scraping Google Scholar");
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
