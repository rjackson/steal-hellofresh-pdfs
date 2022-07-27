import path from "path";
import { createWriteStream } from "fs";
import fetch from "node-fetch";
import { search } from "./lib/hellofresh.js";

for await (const recipe of search()) {
  const { name, cardLink } = recipe;
  // if (!cardLink) {
  //   console.log(`Skipping ${name}; no card link`);
  // }
  console.log(name, cardLink);

  if (process.env.DOWNLOAD_PDFS && cardLink) {
    try {
      // Filenames are formatted RECIPE-SOMEHASH-SOMEOTHERHASH.pdf
      const filename = path.basename(cardLink);

      // Skip "No picture available...yet" files, identifiable by SOMEOTHERHASH
      if (filename.endsWith("39258edf.pdf") || filename.endsWith("25be3635.pdf")) {
        console.log(`Skipping ${name} PDF because its the "no picture available" junk`);
        continue;
      }

      const filestream = createWriteStream(path.join(process.cwd(), `pdfs/${filename}`));
      const res = await fetch(cardLink);
      await new Promise((resolve, reject) => {
        res.body.pipe(filestream);
        res.body.on("error", reject);
        filestream.on("finish", resolve);
      });

      console.log(`Saved ${filename}`);
    } catch (e) {
      console.log("Error", e);
    }
  }
}
