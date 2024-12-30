const puppeteer = require('puppeteer'); // Use puppeteer instead of puppeteer-core
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrapeGoogleScholar() {
  const url = "https://scholar.google.co.in/citations?user=aWWJczwAAAAJ&hl=en";
  
  const browser = await puppeteer.launch({
    headless: true,  // Make sure headless mode is set to true
    args: ['--no-sandbox', '--disable-setuid-sandbox'],  // Disable sandboxing
    timeout: 60000,  // Set timeout to 60 seconds
  });

  const page = await browser.newPage();

  try {
    const navigationPromise = page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,  // 60-second timeout
    });
    await navigationPromise;

    await page.waitForSelector('.gsc_a_tr', { timeout: 60000 });

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
    let previousLength = publications.length;

    while (showMoreButtonVisible) {
      await page.click('#gsc_bpf_more');
      await delay(2000);

      const newPublications = await scrapePublications();
      newPublications.forEach((pub) => {
        if (!publications.some((existing) => existing.title === pub.title && existing.link === pub.link)) {
          publications.push(pub);
        }
      });

      if (publications.length === previousLength) {
        break;
      }

      previousLength = publications.length;
      showMoreButtonVisible = await page.$('#gsc_bpf_more');
    }

    await browser.close();
    return publications;
  } catch (error) {
    console.error("Error scraping Google Scholar:", error);
    await browser.close();
    throw error;
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
