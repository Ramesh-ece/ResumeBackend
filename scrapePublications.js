const puppeteer = require('puppeteer');

async function scrapeGoogleScholar() {
    const url = "https://scholar.google.co.in/citations?user=aWWJczwAAAAJ&hl=en"; // Replace with your Google Scholar link
    const browser = await puppeteer.launch({ headless: false }); // Set headless to false to see the browser action
    const page = await browser.newPage();

    // Navigate to Google Scholar Profile
    await page.goto(url);

    // Wait for the initial publications to load
    await page.waitForSelector('.gsc_a_tr'); // Ensure the first batch of publications is loaded

    let publications = [];
    
    // Scrape the first batch of publications
    const scrapePublications = async () => {
        const newPublications = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('.gsc_a_tr')); // All publication rows
            return rows.map(row => ({
                title: row.querySelector('.gsc_a_at')?.innerText || "",
                authors: row.querySelector('.gsc_a_at + div')?.innerText || "",
                year: row.querySelector('.gsc_a_y')?.innerText || "",
                link: row.querySelector('.gsc_a_at')?.href || "",
            }));
        });
        return newPublications;
    };

    // Load initial publications
    publications = await scrapePublications();

    // Check if "Show More" button is present and click it until all publications are loaded
    let showMoreButtonVisible = await page.$('#gsc_bpf_more');
    
    while (showMoreButtonVisible) {
        console.log("Clicking 'Show More' button...");
        await page.click('#gsc_bpf_more');
        await page.waitForTimeout(2000); // Wait for a few seconds for more publications to load
        
        // Scrape newly loaded publications
        const newPublications = await scrapePublications();
        publications = [...publications, ...newPublications];

        // Check if there's another "Show More" button
        showMoreButtonVisible = await page.$('#gsc_bpf_more');
    }

    console.log(`Total publications scraped: ${publications.length}`);
    
    await browser.close();
    return publications;
}

// Example usage:
scrapeGoogleScholar().then(data => {
    console.log("Scraped Publications:", data);
}).catch(err => {
    console.error("Error scraping Google Scholar:", err);
});
