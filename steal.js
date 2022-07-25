// import Sitemapper from "sitemapper";
// import UserAgent from "user-agents";

import { parseStringPromise } from "xml2js";

import path from "path";
import { createWriteStream, readFileSync } from "fs";
import { JSDOM } from "jsdom";
import fetch from "node-fetch";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// const sitemapper = new Sitemapper({
//   debug: true,
//   requestHeaders: {
//     "User-Agent": new UserAgent({ deviceCategory: "mobile"}),
//   },
// });

// try {
//   // This sitemap is guarded by cloudflare, are u kidding me.
//   const recipes = await sitemapper.fetch("https://www.hellofresh.co.uk/sitemap_recipe_pages.xml");
//   console.log(recipes);
// } catch (e) {
//   console.log(`ERRRRRRER`, e);
// }

const sitemapString = readFileSync(path.join(process.cwd(), "sitemap_recipe_pages.xml"));
const {
  urlset: { url: urlObjects },
} = await parseStringPromise(sitemapString);

const urls = urlObjects.map(({ loc }) => loc);
const pdfUrls = [];

console.log(`Searching ${urls.length} URLs for PDFs`);

while (urls.length > 0) {
  const url = urls.shift();
  try {
    const data = await fetch(url).then((r) => r.text());
    const dom = new JSDOM(data);

    const downloadLinkElem = dom.window.document.querySelector(
      "[data-test-id='recipeDetailFragment.instructions.downloadLink']"
    );

    const pdfUrl = downloadLinkElem?.href;

    if (!pdfUrl) {
      throw new Error("no recipe card :(");
    }

    const filename = path.basename(pdfUrl);
    const filestream = createWriteStream(path.join(process.cwd(), `pdfs/${filename}`));
    const res = await fetch(pdfUrl);
    await new Promise((resolve, reject) => {
      res.body.pipe(filestream);
      res.body.on("error", reject);
      filestream.on("finish", resolve);
    });
    console.log(`Saved ${filename}`);
  } catch (e) {
    console.log(`Skipping ${url} due to error`, e);
  }
  //   await sleep(100);
}
