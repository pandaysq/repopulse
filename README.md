# RepoPulse

RepoPulse is a fast, shareable read on the public signals that make a GitHub repository ready to be seen. Paste a public GitHub URL or an `owner/repository` name to get an overall health score, signal breakdown, recent activity, contributors, highlights, risks, and a shareable report URL.

## Stack

- React + Vite
- TypeScript
- Tailwind CSS
- Lucide icons
- GitHub REST API for public repository data

## Run locally

```bash
pnpm install
PORT=5173 BASE_PATH=/ pnpm run dev
```

RepoPulse requests only public GitHub data from the browser and does not require an API token.
