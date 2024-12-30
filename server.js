const { chromium } = require('playwright');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 4000;

app.use(
  cors({
    origin: 'http://localhost:3000',
  })
);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrapeGoogleScholar() {
  const url = "https://scholar.google.co.in/citations?user=aWWJczwAAAAJ&hl=en";

  try {
    console.log("Launching browser...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url);
    console.log("Page loaded. Waiting for selector...");
    await page.waitForSelector('.gsc_a_tr');
    console.log("Selector found. Scraping publications...");

    let publications = [];
    let previousLength = 0;

    const scrapePublications = async () => {
      return await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.gsc_a_tr'));
        return rows.map((row) => ({
          title: row.querySelector('.gsc_a_at')?.innerText || "",
          authors: row.querySelector('.gsc_a_at + div')?.innerText || "",
          year: row.querySelector('.gsc_a_y')?.innerText || "",
          "Published in": row.querySelector('.gsc_a_at + div + div')?.innerText || "",
          link: row.querySelector('.gsc_a_at')?.href || "",
        }));
      });
    };

    publications = await scrapePublications();

    let showMoreButtonVisible = await page.$('#gsc_bpf_more');
    let showMoreButtonEnabled = await page.isEnabled('#gsc_bpf_more');

    while (showMoreButtonVisible && showMoreButtonEnabled) {
      console.log("Clicking 'Show More' button...");
      await page.click('#gsc_bpf_more');
      await delay(2000); // Wait for new publications to load

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

      // Check if the "Show More" button is disabled
      showMoreButtonVisible = await page.$('#gsc_bpf_more');
      showMoreButtonEnabled = await page.isEnabled('#gsc_bpf_more');
    }

    console.log(`Total publications scraped: ${publications.length}`);
    await browser.close();
    return publications;
  } catch (error) {
    console.error("Error inside scraping process:", error);
    throw new Error("Error while scraping Google Scholar");
  }
}

app.get('/publications', async (req, res) => {
  try {
    console.log('Fetching publications...');
    const publications = await scrapeGoogleScholar();
    res.json(publications); // Send scraped data to client
  } catch (error) {
    console.error("Error scraping Google Scholar:", error);
    res.status(500).send("Error scraping Google Scholar");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
