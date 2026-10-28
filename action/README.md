# Aftershock guard (GitHub Action)

Runs the memory tests relevant to a pull request on your own GitHub Actions runner and reports the result to Aftershock. Aftershock completes its check run and comment exactly as for sandbox runs.

1. In Aftershock, set the repository's runner to **Actions** (Repositories page).
2. Create a token with **read and write** access (Settings → API tokens) and add it as the repository secret `AFTERSHOCK_TOKEN`.
3. Add the workflow:

```yaml
name: Aftershock
on: [pull_request]
jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-python@v5   # or actions/setup-node, setup-go, setup-java, ruby/setup-ruby
        with: { python-version: "3.13" }
      - uses: MaanavKrishna/Aftershock/action@v0.2.1
        with:
          token: ${{ secrets.AFTERSHOCK_TOKEN }}
          install: pip install -r requirements.txt pytest
```

Inputs: `token` (required), `install`, `framework`, `tests` (default `tests/aftershock`), `working-directory`, `pr`, `url`. Exit code 1 means an incident would recur; 2 means inconclusive.

`dist/aftershock.mjs` is the bundled Aftershock CLI (`npm run build:action`); CI checks it matches the source.
