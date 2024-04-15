import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const LANGUAGE_DIR = fileURLToPath(new URL("../src/locales", import.meta.url));

async function read() {
  const [data, addString, dropString] = await Promise.all([
    readdir(LANGUAGE_DIR),
    readFile(fileURLToPath(new URL(`./add.json`, import.meta.url))),
    readFile(fileURLToPath(new URL(`./remove.json`, import.meta.url)))
  ]);

  const add = JSON.parse(addString.toString("utf8"));
  const drop = JSON.parse(dropString.toString("utf8"));
  const promises = [];

  for (const item of data) {
    async function fn() {
      const dir = fileURLToPath(new URL(`../src/locales/${item}`, import.meta.url));
      const fileData = await stat(dir);
      if (fileData.isFile()) {
        const data = await readFile(dir);
        const lang = JSON.parse(data.toString("utf8"));

        for (const key in add) {
          if (!lang.message[key]) {
            lang.message[key] = add[key];
          }
        }

        for (const key of drop) {
          delete lang.message[key];
        }

        const stringify = JSON.stringify(lang, null, "  ");
        await writeFile(fileURLToPath(new URL(`../src/locales/${item}`, import.meta.url)), stringify);
      }
    }
    promises.push(fn());
  }

  await Promise.all(promises);
}

read();
