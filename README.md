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
- `always-keep-regex`: 'An optional regex to specify branch snapshots (versions) that never will be deleted'

## Example usage

```yaml
      - uses: javiertuya/branch-snapshots-action@main
        with: 
          token: ${{ secrets.GITHUB_TOKEN }}
          working-directory: test
          java-version: '8'
          mvn-deploy-args: '-P publish-github -DskipTests=true -Dmaven.test.failure.ignore=false -U --no-transfer-progress'
          delete-old-snapshots: true
          min-snapshots-to-keep: 2
          always-keep-regex: "\\d*\\.\\d*\\.\\d*-main-SNAPSHOT$"
```

This action is better used from a dedicated job or workflow, see job `publish-java-snapshot` in:
[.github/workflows/test.yml](https://github.com/javiertuya/branch-snapshots-action/blob/main/.github/workflows/test.yml)

## How to consume branch snapshots

To consume (install) the branch snapshots from a local development environment, Jenkins or GitHub Actions, follow the below instructions.

### Configure the pom.xml (common to all environments)

Declare the GitHub repository in the pom.xml (you can specify * instead of the repo name), example:
```xml
  <repositories>
    <repository>
      <id>github</id>
      <url>https://maven.pkg.github.com/USERNAME-OR-ORGANIZATION/REPOSITORY</url>
      <snapshots>
        <enabled>true</enabled>
      </snapshots>
    </repository>
  </repositories>
```

and follow the below instructions for each environment

### Install from GitHub Actions

The workflow requires authentication with a token with scope `read:packages`.
This can be achieved by specifying the environment variable
`GITHUB_TOKEN` associated with the workflow repository:

```yaml
      - name: Build and test
        run: mvn test -U
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Install from a local development environment

Authentication must be included in a `settings.xml` file in your `~/.m2` folder.
The `id` (`github` in the example) must match the `id` indicated in the pom.xml file.
The GitHub token must have the `read:packages` scope:

```xml
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0
                      http://maven.apache.org/xsd/settings-1.0.0.xsd">
  <servers>
    <server>
      <id>github</id>
      <username>USERNAME</username>
      <password>TOKEN</password>
    </server>
  </servers>
</settings>
```

### Install from Jenkins

Autentication is similar to that of a local environment, but you can safely save the token in Jenkins:
- Place the `settings.xml` file in the jenkins node (agent) `~/.m2` folder.
- For security reasons, instead of use a plain text token,
you should use an environment variable, for example, `${GITHUB_TOKEN}`
- Add a "secret text" credential to Jenkins with the token ant take note of the `credential_id`
- Then, use the Jenkins Credentials Binding Plugin (https://www.jenkins.io/doc/pipeline/steps/credentials-binding/) 
  in your pipeline to inject the secret:
```groovy
    withCredentials([string(credentialsId: 'credential_id', variable: 'GITHUB_TOKEN')]) {
      sh 'mvn test -U'
    }
```
