# Languages

Aftershock proves a test by running it in a fresh environment: once on the commit before the fix (it must fail every time) and once on the fix (it must pass every time). Each framework below is detected from the repository and can be overridden in `.aftershock/config.yaml` (`framework:`).

| Framework | Detected from | Where drafts go | Notes |
|---|---|---|---|
| pytest | `requirements.txt`, `pyproject.toml` | `tests/aftershock/test_<name>.py` | Virtualenv per run |
| vitest / jest | `package.json` | `tests/aftershock/<name>.test.ts` | |
| Go `go test` *(Labs)* | `go.mod` | `<package>/aftershock_<name>_test.go`, function `TestAftershock<Name>` | Only `TestAftershock*` runs; JUnit via `gotestsum` |
| JUnit, Maven or Gradle *(Labs)* | `pom.xml`, `build.gradle(.kts)` | `src/test/java/<package>/Aftershock<Name>Test.java` (or Kotlin under `src/test/kotlin`) | Gradle uses the repository's `./gradlew` |
| RSpec *(Labs)* | `Gemfile` | `spec/aftershock/<name>_spec.rb` | No extra gems needed |

Frameworks marked *Labs* are turned on per workspace in **Settings → Labs**. Until then, time travel explains how to turn them on and pull request checks skip their tests with the reason.

## How a run works

1. **Install** (network allowed): the toolchain if the image lacks it, then your install command. Caches (Go modules, Maven repository, Gradle home, Bundler path) live inside the checkout so the next phase can run offline.
2. **Test** (network denied): exactly one test file, written after the install, three times. The result is read from a JUnit report.
3. If the test cannot even compile or load because the code it covers does not exist at that commit, the result is *missing code*, never a recurrence, and Epicenter uses it as a boundary.
