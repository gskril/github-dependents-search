# GitHub Search - Viem Repository Finder

Search GitHub for repositories that use the [viem](https://viem.sh) library by scanning `package.json` files.

## Features

- Uses GitHub Code Search API to find "viem" in package.json files
- Excludes archived repositories
- Sorts results by star count (descending)
- Exports results to JSON using Bun's native file writing

## Prerequisites

1. **Bun**: Install from [bun.sh](https://bun.sh)
2. **GitHub Personal Access Token**: Required for Code Search API access

### Getting a GitHub Token

1. Go to [https://github.com/settings/tokens](https://github.com/settings/tokens)
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name (e.g., "GitHub Search")
4. Select the `public_repo` scope
5. Generate and copy the token

## Setup

Install dependencies:

```bash
bun install
```

Set your GitHub token:

```bash
export GITHUB_TOKEN=your_token_here
```

## Usage

Run the search:

```bash
bun run src/index.ts
# or
bun start
```

The script will:

1. Search for "viem" in package.json files across GitHub
2. Extract unique repositories
3. Sort by star count
4. Export results to `viem_repositories.json`

## Output

The JSON file contains an array of repositories with:

- `name`: Repository name
- `full_name`: Full repository name (owner/repo)
- `description`: Repository description
- `stars`: Number of stars
- `url`: GitHub URL
- `language`: Primary programming language
- `created_at`: Creation date
- `updated_at`: Last update date

## Notes

- **API Limitations**: The GitHub Search API has a hard limit of 1,000 results maximum, even though more results may exist. The script fetches up to 10 pages (100 results each) to maximize coverage.
- **Rate Limits**: The Code Search API allows 10 requests per minute for authenticated users. The script includes automatic delays between requests.
- **Comparison to UI**: GitHub's web interface may show more total results (e.g., 49k files), but the API can only return the first 1,000 matches due to [GitHub API limitations](https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28#about-search).
- **Execution Time**: Fetching 10 pages with rate limiting takes approximately 1 minute.
