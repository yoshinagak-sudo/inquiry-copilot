# Inquiry Copilot

AI-drafted email replies for customer-facing teams — the model writes the draft, a human ships it with one click, and the corrections feed back into an evolving knowledge base.

## Why it exists

Butai Farm's customer-facing team handles a steady stream of repetitive inquiries (delivery schedules, product availability, invoicing). Most replies follow the same shape, but each one still costs minutes of context-switching. Inquiry Copilot collapses that loop without surrendering the human's judgment about tone or detail.

## How it works

```
Inbound email  →  AI drafts reply  →  Human reviews & edits  →  One-click send
                                              ↓
                                     Edit diffs feed the knowledge base
                                              ↓
                                       Next draft is better
```

The system never auto-sends. Every reply passes through a person, and every human edit becomes a training signal for future drafts.

## Stack

- Next.js 16 / React 19 / TypeScript / Tailwind v4
- Claude / Gemini API for draft generation
- PostgreSQL for inquiry history and knowledge base
- Slack notifications when new inquiries arrive

## Design notes

- **AI in the draft seat, human in the driver seat.** The pattern is borrowed from how Palantir-style deployments use LLMs as translators, not decision-makers.
- **The knowledge base grows from corrections, not from explicit curation.** Difference between draft and sent reply is the highest-value training signal.

## Run locally

```bash
npm install
cp .env.example .env.local
npx prisma migrate dev
npm run dev
```

---

Built by [Keigo Yoshinaga](https://github.com/yoshinagak-sudo) — Project Lead, Future Strategy Dept @ Butai Farm. Part of the in-house operational toolkit reducing repetitive desk work for the customer-service team.
