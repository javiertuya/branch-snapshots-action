# Branch Snapshots Action

This action publishes maven branch snapshots to the GitHub Packages Maven registry.
Each time that it is executed, builds the system and publishes a snapshot with the version in the form
`<version number>-<branch name>-SNAPSHOT`.

## Inputs

- `token` *(Required)*: Token to access GitHub Packages
- `working-directory` *(Default to root directory)*: The name of the working directory from which the mvn deploy is executed'
- `java-version` *(Required)*: Java version used to build the package
- `mvn-deploy-args`: Optional arguments to be passed to the `mvn deploy` command
- `delete-old-snapshots` *(Default false)*: If true, keeps only `min-snapshots-to-keep` branch snapshots (versions)
- `min-snapshots-to-keep` *(Default 2)*: The number of latest branch snapshots (versions) to keep if `delete-old-snapshots` is true

## Example usage

```yaml
      - uses: javiertuya/branch-snapshots-action@v1.1.0
        with: 
          token: ${{ secrets.GITHUB_TOKEN }}
          working-directory: test
          java-version: '8'
          mvn-deploy-args: '-P publish-github -DskipTests=true -Dmaven.test.failure.ignore=false -U --no-transfer-progress'
          delete-old-snapshots: true
          min-snapshots-to-keep: 4
```

This action is better used from a dedicated job or workflow, see job `publish-java-snapshot` in:
[github/workflows/test.yml](https://github.com/javiertuya/branch-snapshots-action/blob/multimodule/.github/workflows/test.yml)