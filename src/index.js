import "dotenv/config";

import { search } from "./lib/hellofresh.js";
import algoliasearch from "algoliasearch";

const createAlgoliaRecord = (recipe) => {
  const {
    id, // Dont trust uuid or uniqueRecipeCode, those aren't set for everything. TODO: Figure out why
    name,
    category: categoryObject,
    country,
    headline,
    description,
    difficulty,
    prepTime,
    servingSize,
    createdAt,
    updatedAt,
    imagePath,
    cardLink,
    websiteUrl,
    author,
    uniqueRecipeCode,
    averageRating,
    ratingsCount,
    favoritesCount,
    nutrition: nutritionObjects,
    ingredients: ingredientObjects,
    allergens: allergenObjects,
    utensils: utensilObjects,
    tags: tagObjects,
    cuisines: cuisineObjects,
    yields: yieldObjects,
  } = recipe;

  // TODO: Observe all HelloFresh nutrition values to determine fixed nutrition object to send
  const nutrition = {};
  // TODO: Observe all HelloFresh allergen values to determine fixed allergen object to send?
  const allergens = allergenObjects.map(({ name }) => name);

  const category = categoryObject?.name;
  const ingredients = ingredientObjects.map(({ name }) => name);
  const utensils = utensilObjects.map(({ name }) => name);
  const tags = tagObjects.map(({ name }) => name);
  const cuisines = cuisineObjects.map(({ name }) => name);
  const yields = yieldObjects.map(({ yields }) => yields);

  return {
    objectID: id,
    name,
    country,
    headline,
    description,
    difficulty: ["Not rated", "Easy", "Medium", "Experienced"][difficulty],
    prepTime,
    servingSize,
    createdAt,
    updatedAt,
    image: `https://img.hellofresh.com/hellofresh_s3${imagePath}`,
    cardLink,
    websiteUrl,
    author,
    uniqueRecipeCode,
    category,
    nutrition,
    ingredients,
    allergens,
    utensils,
    tags,
    cuisines,
    yields,
    averageRating,
    ratingsCount,
    favoritesCount,
  };
};

const appId = process.env.ALGOLIA_APP_ID;
const apiKey = process.env.ALGOLIA_API_KEY;
const client = algoliasearch(appId, apiKey);
const index = client.initIndex("hellofresh-recipes");

let queue = [];

for await (const recipe of search()) {
  queue.push(createAlgoliaRecord(recipe));

  if (queue.length === 200) {
    console.log("Pushing recipes to Algolia");
    try {
      index.saveObjects(queue, { autoGenerateObjectIDIfNotExist: true });
    } catch (e) {
      console.log(e);
      process.exit(1);
    }
    queue = [];
  }
}

if (queue.length > 0) {
  console.log("Pushing recipes to Algolia");
  index.saveObjects(queue, { autoGenerateObjectIDIfNotExist: true });
  queue = [];
}
