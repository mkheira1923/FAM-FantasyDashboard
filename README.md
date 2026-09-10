# FAM Fantasy Football Dashboard

Public presentation site for the **FAM Fantasy Football** league record book.

**League:** ESPN 664749  
**History:** 2010-present  
**Live site:** https://mkheira1923.github.io/FAM-FantasyDashboard/

## What is on the site

The dashboard is an interactive, mobile-friendly league history built from the validated private FAM data pipeline. It includes:

- defending champion feature on the front page;
- current-season ESPN power-rank board;
- all-time standings for the current 12;
- championship trophy case and ring board;
- interactive manager-vs-manager H2H comparison;
- regular-season, title-playoff, competitive and postseason H2H matrices;
- rivalry rankings;
- league scoring/game records;
- individual manager profiles with career stats, seasons, titles, rivalries and historical team names;
- season-by-season league history;
- former-manager history;
- weekly score archive;
- true championship-bracket archive; and
- historical draft search.

## Data architecture

This repository is deliberately **presentation-only**.

The private repository `FAM-FantasyFootball` remains the source of truth. It authenticates to ESPN, preserves raw league history, normalizes manager ownership, validates the historical record, generates the Excel record book, and creates a sanitized public payload.

```text
ESPN private league
      ↓
PRIVATE FAM-FantasyFootball
      ↓
raw archive + weekly snapshots
      ↓
owner normalization + historical validation
      ↓
Excel record book + Yahoo email
      ↓
allow-listed public-data generator
      ↓
PUBLIC FAM-FantasyDashboard
      ↓
GitHub Pages
```

Only the sanitized output needed by the website is written to `data/` here.

## What is never published here

The public-data generator has a publication guard and intentionally excludes:

- ESPN `espn_s2` / `SWID` authentication values;
- ESPN owner/member GUIDs;
- raw ESPN API responses;
- raw transaction JSON;
- private mapping/audit identifiers; and
- private GitHub Actions secrets.

If a forbidden identifier/field pattern is found in the generated public payload, the private pipeline stops instead of publishing it.

## Historical rules

The dashboard follows the same validated rules as the private record book:

- regular-season record is tracked separately;
- **title playoff record** includes only games where a team is still on the championship path;
- later placement games do not inflate playoff records;
- consolation is tracked separately;
- manager history follows canonical ESPN owner/member identity rather than reused team IDs; and
- former managers stay separate from the current 12.

## Current 12

Vijay · Neil · Hark · Atit · TI · Preet · Mike · Manu · Ricky · TJ · JJ · Pa Jay

## Updates

The private backend is designed to run every Tuesday morning during the season. A successful run verifies the ESPN API, refreshes history, preserves the week's power-rank snapshot, rebuilds/validates the record book, emails the Excel workbook, and then updates the sanitized dashboard data in this repository.

Static files in this repository are then published through GitHub Pages.

## Disclaimer

This is an unofficial private-league fan project. It is not affiliated with or endorsed by ESPN or The Walt Disney Company. ESPN data is accessed through unofficial/undocumented endpoints and is validated/preserved by the private project pipeline before presentation here.
