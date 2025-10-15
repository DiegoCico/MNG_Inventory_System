# Commands

### Install everything

```bash
npm install
```

This grabs all dependencies for the **frontend**, **api**, and **cdk** workspaces in one shot.

---

### Run tests

```bash
npm run test
```

Runs the **API and frontend tests**. If they fail, you know right away before starting anything else.

---

### Dev mode (servers only)

```bash
npm run dev
```

Spins up **frontend (Vite on 5173)** and **API (Express on 3001)** at the same time. No tests, just raw dev mode.

---

### Start (tests first, then servers)

```bash
npm run start
```

Runs API and frontend tests **first**. If they pass, it will start **frontend + API** in parallel. If tests fail, servers won’t start — nice little safety net.

---

That’s basically it. Install, test, dev, start.
