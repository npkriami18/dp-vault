# Design Patterns Vault

A personal progress dashboard for tracking design patterns exercises with Claude.

## What it does

- Stores all your C++ code submissions, MCQ answers, and UML attempts
- Syncs with JSONBin as a free JSON database
- Hosted statically on GitHub Pages — no backend needed
- Claude posts exercise data automatically after each submission

## Setup (5 minutes)

### Step 1 — Create a JSONBin account
1. Go to [jsonbin.io](https://jsonbin.io) and create a free account
2. Go to **API Keys** → copy your **Master Key**
3. Click **New Bin** → paste this as initial content:
   ```json
   { "entries": [] }
   ```
4. Copy the **Bin ID** from the URL (the long hex string)

### Step 2 — Enable GitHub Pages
1. Push these files to a GitHub repo (e.g. `dp-vault`)
2. Go to repo **Settings → Pages**
3. Set source to **main branch / root folder**
4. Your site will be live at `https://yourusername.github.io/dp-vault`

### Step 3 — Connect the vault
1. Open your GitHub Pages URL
2. Enter your JSONBin **Master Key** and **Bin ID**
3. Click **Connect vault**

Credentials are stored in your browser's localStorage — never sent anywhere except directly to JSONBin.

### Step 4 — Tell Claude your vault URL
In your Claude session, paste:
> My vault is at: `https://yourusername.github.io/dp-vault`
> JSONBin API Key: `your-master-key`
> Bin ID: `your-bin-id`

Claude will POST exercise data to JSONBin after every submission.

## File structure

```
dp-vault/
├── index.html   — dashboard UI
├── style.css    — styles
├── app.js       — data logic + JSONBin integration
└── README.md    — this file
```

## Entry format (sent by Claude)

```json
{
  "type":        "code | mcq | uml",
  "title":       "Strategy Pattern — PaymentProcessor",
  "phase":       "Phase 3 — Patterns",
  "topic":       "Strategy",
  "ts":          1709123456789,

  // code entries
  "content":     "class IPaymentStrategy { ... }",
  "feedback":    "Good abstraction. Consider making pay() const.",

  // mcq entries
  "question":    "Which principle says one reason to change?",
  "answer":      "Single Responsibility Principle",
  "correct":     true,
  "explanation": "SRP: ...",

  // uml entries
  "content":     "Drew ISubject → ConcreteSubject, IObserver → ConcreteObserver"
}
```
