import fetch from "node-fetch";
import { JSDOM } from "jsdom";

const getToken = async () => {
  const res = await fetch("https://www.hellofresh.co.uk/");
  const text = await res.text();
  const dom = new JSDOM(text);
  const nextData = JSON.parse(
    dom.window.document.querySelector("script#__NEXT_DATA__[type='application/json']").textContent
  );

  const token = nextData?.props?.pageProps?.ssrPayload?.serverAuth?.access_token;
  return token;
};

export async function* search(country = "GB", locale = "en-GB", MAX_CALLS = 1000, MAX_PER_PAGE = 250) {
  const token = await getToken();

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
