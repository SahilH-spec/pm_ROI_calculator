# Property Operations ROI Estimate

A single-page calculator that estimates annual time and cost savings for property management teams managing 40 to 499 units. It works from portfolio size, staff hours, current tools, and software spend.

No build step and no server. It's one `index.html` file. Open it in a browser, or host it on GitHub Pages or any static web server.

## What it calculates

- **Team time returned:** weekly hours per task × a time-savings rate × the hourly cost of the role doing it. Paper check handling is calculated separately.
- **Tools no longer needed:** monthly cost of every tool marked "Replace."
- **Rent from faster turns (optional):** units turned per year × vacant days saved × daily rent.
- **Platform cost:** either a per-unit rate with a monthly minimum, or a flat amount you enter.
- **Results:** net annual value, first-year return (after setup), payback in months, value per unit, hours returned, and how many more units the team could take on.

Results come in three scenarios: conservative, expected, and aggressive.

## Before sharing with prospects

All time-savings rates, hourly costs, tool costs, and platform pricing are **placeholders**. They live in the `CONFIG` block at the top of the `<script>` section of `index.html`.

1. Replace the placeholder values with verified figures. Get them from enablement or governed sources.
2. Set `showPlaceholderNotice: false` to hide the "Sample assumptions" banner.
3. Have the numbers reviewed before using them with customers.

## Run locally

Double-click `index.html`. Inputs are saved in that browser only.

## Publish with GitHub Pages

1. Create a new repository, e.g. `pm-roi-calculator`. Keep it **private** until hosting has been cleared with #security.
2. Upload `index.html` and `README.md`. Use **Add file → Upload files**, then commit.
3. Go to **Settings → Pages**. Set **Source** to "Deploy from a branch," choose `main` and `/ (root)`, and click **Save**.
4. After a minute or two the site appears at `https://<your-username>.github.io/pm-roi-calculator/`.

Note: GitHub Pages sites are public on free and personal plans, even when the repository is private.

## Updating

Edit `CONFIG` in `index.html` and commit. GitHub Pages redeploys automatically.
