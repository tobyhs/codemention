<p align="center">
  <a href="https://github.com/tobyhs/codemention/actions"><img alt="typescript-action status" src="https://github.com/tobyhs/codemention/workflows/build-test/badge.svg"></a>
</p>

# CodeMention

CodeMention is a GitHub Action that mentions users and teams who subscribe to certain file changes on pull requests.
See in pull requests in the [codemention-test repo](https://github.com/tobyhs/codemention-test/pulls?q=is%3Apr) for examples of how this looks like.

This is similar to [Codenotify](https://github.com/sourcegraph/codenotify), but this retrieves the list of files changed via GitHub's REST API instead of using [actions/checkout](https://github.com/actions/checkout) to clone the repo (which can be problematic on large repos).

## Usage

To use this GitHub Action, add a `.github/codemention.yml` file to your repo that contains mentions/notifications rules.
An example looks like:
```yaml
rules:
  - patterns: ['config/**']
    mentions: ['sysadmin']
  - patterns: ['db/migrate/**']
    mentions: ['cto', 'dba']
  - patterns: ['.github/**', 'spec/*.rb']
    mentions: ['ci']
```

See the Configuration interface in [src/configuration.ts](src/configuration.ts) for possible options.

Add a `.github/workflows/codemention.yml` file to your repo with the following:
```yaml
name: codemention

on:
  pull_request_target:
    types: [opened, synchronize, ready_for_review]

jobs:
  codemention:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: tobyhs/codemention@v2
        with:
          githubToken: ${{ secrets.GITHUB_TOKEN }}
```

Due to GitHub Actions [access restrictions on caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache), a pull request typically cannot save a cache that other pull requests can use. To work around this, you can create a workflow that saves the dpendency cache in the default branch scope with a file like the following (replace `main` with your default branch):
```yaml
name: 'codemention: populate cache'

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  codemention_populate_cache:
    runs-on: ubuntu-latest
    steps:
      - uses: tobyhs/codemention/populate-cache@v2
```

### Team Mentions

In order for CodeMention to mention teams, you need to use a GitHub [personal access token](https://github.com/settings/tokens) that has [organization permissions to read members](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens?apiVersion=2022-11-28#organization-permissions-for-members).
Replace the `githubToken` input with your personal access token.
