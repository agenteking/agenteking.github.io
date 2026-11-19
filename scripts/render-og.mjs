// Genera web/public/og.png (1200x630) desde scripts/og/og.html con el nombre de marca.
// Uso: npm i --no-save puppeteer && VITE_BRAND_NAME=MiMarca node scripts/render-og.mjs
// (CHROME=/ruta/al/chrome si puppeteer no trae su propio navegador)
import "dotenv/config";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const root = fileURLToPath(new URL("..", import.meta.url));
const brand = process.env.VITE_BRAND_NAME || "Aparece";
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME || undefined });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(`${pathToFileURL(`${root}scripts/og/og.html`).href}?brand=${encodeURIComponent(brand)}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${root}web/public/og.png`, type: "png" });
await browser.close();
console.log(`og.png generado para "${brand}"`);
