# Branch Snapshots Action

This action publishes branch snapshots to the GitHub Packages Maven registry.
Each time that it is executed, builds the system and publishes a snapshot with the version name `<version number>-<branch name>-SNAPSHOT`.

NOTE: This action does a checkout and manipultes the version number in the pom.xml before publishing: it must be run in a dedicated job or workflow.

## Inputs

- `token`: Token to access GitHub Packages
- `java-version`: Java version used to build the package
- `mvn-deploy-args`: Optional arguments to be passed to the `mvn deploy` command
- `package-name`: Name of the package to publish
- `delete-old-versions`: If true, keeps only `min-versions-to-keep` versions. Default: false.
  NOTE: First time that a package is published, this parameter must be set to false
  to avoid a failure on deletion.
- `min-versions-to-keep`: The number of latest versions to keep if `delete-old-versions` is true. Default: 2

## Example usage

See https://github.com/javiertuya/branch-snapshots, workflow called `test.yml`:

```yaml
      - uses: javiertuya/branch-snapshots-action@main
        with: 
          token: ${{ secrets.GITHUB_TOKEN }}
          java-version: '8'
          mvn-deploy-args: '-P publish-github -DskipTests=true -Dmaven.test.failure.ignore=true -U --no-transfer-progress'
          package-name: 'giis.branch-snapshots'
          delete-old-versions: true
          min-versions-to-keep: 4
```
