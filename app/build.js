// node app/build.js : inlines CSS, engine and app code into one standalone index.html at the repo root.
const fs = require("fs"), path = require("path");
const r = (f) => fs.readFileSync(path.join(__dirname, f), "utf8");
const app = ["src/help.js", "src/app.js", "src/export.js", "src/main.js"].map(r).join("\n");
const page = r("src/template.html").replace("/*CSS*/", () => r("src/styles.css")).replace("/*ENGINE*/", () => r("engine.js")).replace("/*APP*/", () => app);
const out = path.join(__dirname, "..", "index.html");
fs.writeFileSync(out,
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
  '<meta name="description" content="A discovery-call ROI calculator for property managers. Models cash, capacity and owner value separately, with break-even first.">\n' +
  '<style>html{color-scheme:light}body{margin:0}</style>\n</head>\n<body>\n' + page + "\n</body>\n</html>\n");
console.log("built index.html,", fs.statSync(out).size, "bytes");
