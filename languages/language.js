import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const LANGUAGE_DIR = fileURLToPath(new URL("../src/locales", import.meta.url));
const PRIMARY = "en.json";
const langugages = {};

async function read() {
  const [data, primaryLangString] = await Promise.all([
    readdir(LANGUAGE_DIR),
    readFile(fileURLToPath(new URL(`../src/locales/${PRIMARY}`, import.meta.url)))
  ]);
  const primaryLang = JSON.parse(primaryLangString.toString("utf8"));
  const promises = [];
  for (const item of data) {
    langugages[item] = {
      length: 0,
      drop: [],
      missing: []
    };

    async function fn() {
      const dir = fileURLToPath(new URL(`../src/locales/${item}`, import.meta.url));
      const data = await readFile(dir);
      const lang = JSON.parse(data.toString("utf8"));
      langugages[item].length = Object.keys(lang.message).length;
      for (const key in lang.message) {
        if (!primaryLang.message[key]) {
          langugages[item].drop.push(key);
        }
      }

      for (const key in primaryLang.message) {
        if (!lang.message[key]) {
          langugages[item].missing.push(key);
        }
      }
    }

    promises.push(fn());
  }

  await Promise.all(promises);

  console.log(langugages);
}

read();
