const puppeteer = require('puppeteer');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrapeGoogleScholar() {
  const url = "https://scholar.google.co.in/citations?user=aWWJczwAAAAJ&hl=en";
  const browser = await puppeteer.launch({
    headless: true,  // Set to false to debug in the browser
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    timeout: 60000,  // Set timeout to 60 seconds
  });
  const page = await browser.newPage();

  try {
    // Navigate to the page
    const navigationPromise = page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,  // 60-second timeout
    });
    await navigationPromise;

    await page.waitForSelector('.gsc_a_tr', { timeout: 60000 });  // Wait for the publication table

    let publications = [];
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
    let previousLength = publications.length;  // Initialize previousLength to the current length of publications

    while (showMoreButtonVisible) {
      await page.click('#gsc_bpf_more');
      await delay(2000); // Delay for 2 seconds before scraping again

      const newPublications = await scrapePublications();
      newPublications.forEach((pub) => {
        if (!publications.some((existing) => existing.title === pub.title && existing.link === pub.link)) {
          publications.push(pub);
        }
      });

      if (publications.length === previousLength) {
        break;
      }

      previousLength = publications.length;  // Update previousLength after adding new publications
      showMoreButtonVisible = await page.$('#gsc_bpf_more');
    }

    await browser.close();
    return publications;
  } catch (error) {
    console.error("Error scraping Google Scholar:", error);
    await browser.close();
    throw error;  // Rethrow error after closing the browser
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).send("OK");
  }

  try {
    const publications = await scrapeGoogleScholar();
    res.json(publications);
  } catch (error) {
    console.error("Error scraping Google Scholar:", error);
    res.status(500).send("Error scraping Google Scholar");
  }
};
