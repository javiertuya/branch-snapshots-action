# delete-snapshots

Removes the oldest versions of GitHub packages published in a repository.

## Inputs

- `token` *(Required)*: Token to access GitHub Packages (with `read:packages` and `delete:packages` scopes)
- `repoFullName` *(Required)*: The full name of the repository (e.g. `owner/repo`)
- `packageType` *(Required)*: The type of supported package. Can be one of: npm, maven, rubygems, docker, nuget, container
- `versionsToKeep` *(Default 2)*: The number of latest versions to keep
- `alwaysKeepRegex`: An optional regex to specify versions that should never be deleted
- `dryRun` *(Default false)*: If true, the action will only log the versions that would be deleted without actually deleting them

## Design

- List all GitHub packages of the specified `packageType` accessible with the provided `token`
- Filter to those associated with the repository given in `repoFullName`
- For each selected package, log its name and then:
  - Retrieve all versions, ignoring any whose name matches `alwaysKeepRegex` if that input is non‑empty
  - If `dryRun` is false, delete the older versions, keeping the most recent `versionsToKeep`, and log each deletion
  - If `dryRun` is true, only log which versions would be deleted

## Usage as a CLI

This folder contains a small Node.js (ESM) application that implements the behavior described above. To install dependencies and run:

```bash
cd delete-snapshots
npm install
# set environment variables or pass arguments
node src/index.js \
  --token="<GH_TOKEN>" \
  --repoFullName="owner/repo" \
  --packageType="npm" \
  [--versionsToKeep=2] \
  [--alwaysKeepRegex="^stable-"] \
  [--dryRun]
```

Parameters may also be supplied via environment variables with the same names (`token`, `repoFullName`, etc.). The program uses `@octokit/rest` to access the GitHub API and follows the same deletion rules as the GitHub Action.

The command now supports both user and organization repositories. During execution the script queries the repository API (`GET /repos/{owner}/{repo}`) to detect whether the owner is a `User` or an `Organization`, and adjusts package endpoints (`/users/...` or `/orgs/...`) accordingly.

> **Note:** the script is designed to run from the `delete-snapshots` directory and requires Node.js >= 16 with ESM support.

