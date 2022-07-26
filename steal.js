import path from "path";
import { createWriteStream } from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

const getHellofreshToken = async () => {
  const res = await fetch("https://www.hellofresh.co.uk/");
  const text = await res.text();
  const dom = new JSDOM(text);
  const nextData = JSON.parse(
    dom.window.document.querySelector("script#__NEXT_DATA__[type='application/json']").textContent
  );

  const token = nextData?.props?.pageProps?.ssrPayload?.serverAuth?.access_token;
  return token;
};

async function* searchHelloFresh(country = "GB", locale = "en-GB", MAX_CALLS = 1000, MAX_PER_PAGE = 250) {
  const token = await getHellofreshToken();

  let take = MAX_PER_PAGE;
  let skip = 0;

  let calls = 0;

  while (true) {
    const res = await fetch(
      "https://www.hellofresh.co.uk/gw/recipes/recipes/search?" +
        new URLSearchParams({
          country,
          locale,
          skip,
          take,
        }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data = await res.json();
    const { count, total, items, unique_code } = data;

    // This means there was an error. This seems to happen on item 3493.
    // To work around erroneous recipes, half the search space until we hit it
    // Then skip over
    if (unique_code) {
      // We have found the troublesome recipe. Skip it
      if (take == 1) {
        skip++;
        take = MAX_PER_PAGE;
        continue;
      }

      // Half the search space and try again. This will take us all the way up to the erroneous recipe
      take = Math.max(take / 2, 1);
      continue;
    }

    if (items.length === 0 || calls >= MAX_CALLS) {
      break;
    }

    skip += count;
    calls++;

    for (const recipe of items) {
      yield recipe;
    }
  }
}

for await (const recipe of searchHelloFresh()) {
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
      if (filename.endsWith("39258edf.pdf")) {
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
