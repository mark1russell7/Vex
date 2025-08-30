#!/usr/bin/env node
// Concatenate all .ts/.tsx files under ./src into a single Markdown file.
// Usage:
//   node scripts/concat-src.js [output.md]
// Default output: src-catalog.md

import fs from "node:fs";
import path from "node:path";
import process from "node:process"; // ⟵ add this

const fsp = fs.promises;

const root = process.cwd();
const SRC_DIR = root;
const OUTPUT = process.argv[2] || "src-catalog.md";
const EXTS = new Set([".ts", ".tsx"]);

// Recursively collect .ts/.tsx files
async function walk(dir, acc = []) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) continue; // skip hidden
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, acc);
    } else if (EXTS.has(path.extname(e.name))) {
      acc.push(full);
    }
  }
  return acc;
}

// Build a simple ASCII tree showing only dirs and .ts/.tsx files
function buildTree(dir, prefix = "") {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() || EXTS.has(path.extname(e.name)))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const lines = [];
  entries.forEach((e, i) => {
    const connector = i === entries.length - 1 ? "└── " : "├── ";
    const nextPrefix = i === entries.length - 1 ? "    " : "│   ";
    const name = e.name + (e.isDirectory() ? "/" : "");
    lines.push(prefix + connector + name);
    if (e.isDirectory()) {
      lines.push(buildTree(path.join(dir, e.name), prefix + nextPrefix));
    }
  });
  return lines.join("\n");
}

// Ensure POSIX-style paths in the markdown (prettier on Windows)
function toPosix(p) {
  return p.split(path.sep).join("/");
}

// Pick a fence length that won’t collide with backticks inside the file
function pickFenceFor(content) {
  const matches = content.match(/`+/g);
  const maxRun = matches ? Math.max(...matches.map((s) => s.length)) : 0;
  const length = Math.max(3, maxRun + 1);
  return "`".repeat(length);
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`⚠️  No ./src directory found at: ${SRC_DIR}`);
    process.exit(1);
  }

  const files = (await walk(SRC_DIR)).sort((a, b) => a.localeCompare(b));
  const tree = buildTree(SRC_DIR);

  let out = "";
  out += "# Source Catalog (TypeScript)\n\n";
  out += `Generated on ${new Date().toISOString()}\n\n`;
  out += "## Directory structure (src)\n\n";
  out += "```\n" + tree + "\n```\n\n";
  out += "## Files\n\n";

  for (const absPath of files) {
    const rel = toPosix(path.relative(root, absPath));
    const content = fs.readFileSync(absPath, "utf8");
    const fence = pickFenceFor(content);
    const lang = path.extname(absPath) === ".tsx" ? "tsx" : "ts";

    out += `### ${rel}\n\n`;
    out += `${fence} ${lang}\n${content}\n${fence}\n\n`;
  }

  await fsp.writeFile(path.join(root, OUTPUT), out, "utf8");
  console.log(`✅ Wrote ${OUTPUT} with ${files.length} files.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
