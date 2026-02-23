#!/usr/bin/env node
import { Octokit } from "@octokit/rest";
import minimist from "minimist";

// parse options from env and command-line
const argv = minimist(process.argv.slice(2), {
  string: ["token", "repoFullName", "packageType", "alwaysKeepRegex"],
  boolean: ["dryRun"],
  alias: { t: "token", r: "repoFullName", p: "packageType", k: "versionsToKeep" },
  default: { versionsToKeep: 2, dryRun: false }
});

function getInput(name, required = false) {
  if (argv[name] !== undefined && argv[name] !== "") {
    return argv[name];
  }
  if (process.env[name] !== undefined && process.env[name] !== "") {
    return process.env[name];
  }
  if (required) {
    console.error(`Missing required input: ${name}`);
    process.exit(1);
  }
  return undefined;
}

// helper functions that encapsulate API calls
async function listPackages(octokit, packageType, ownerType, owner) {
  // ownerType should be 'users' or 'orgs'
  const results = [];
  let page = 1;
  const path = `GET /${ownerType}/{owner}/packages`;
  while (true) {
    const res = await octokit.request(path, {
      owner,
      package_type: packageType,
      per_page: 100,
      page
    });
    results.push(...res.data);
    if (res.data.length < 100) break;
    page++;
  }
  return results;
}

async function listPackageVersions(octokit, packageType, packageName, ownerType, owner) {
  const results = [];
  let page = 1;
  const path = `GET /${ownerType}/{owner}/packages/{package_type}/{package_name}/versions`;
  while (true) {
    const res = await octokit.request(path, {
      owner,
      package_type: packageType,
      package_name: packageName,
      per_page: 100,
      page
    });
    results.push(...res.data);
    if (res.data.length < 100) break;
    page++;
  }
  return results;
}

async function deletePackageVersion(octokit, packageType, packageName, versionId, ownerType, owner) {
  const path = `DELETE /${ownerType}/{owner}/packages/{package_type}/{package_name}/versions/{version_id}`;
  return octokit.request(path, {
    owner,
    package_type: packageType,
    package_name: packageName,
    version_id: versionId
  });
}

// compute which versions should be deleted given filtering rules
function selectVersionsToDelete(versions, alwaysKeepRegex, versionsToKeep) {
  let regex = null;
  if (alwaysKeepRegex) {
    try {
      regex = new RegExp(alwaysKeepRegex);
    } catch (e) {
      throw new Error(`invalid regex for alwaysKeepRegex: ${e.message}`);
    }
  }

  const filtered = versions
    .filter(v => !regex || !regex.test(v.name))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return filtered.slice(versionsToKeep);
}

import { fileURLToPath } from 'url';

async function processPackage( // NOSONAR - this is a big function but it's the main logic and splitting it up more would just add unnecessary complexity
  octokit,
  pkg,
  repoFullName,
  packageType,
  versionsToKeep,
  alwaysKeepRegex,
  dryRun,
  ownerType,
  owner
) {
  const pkgRepo = pkg.repository && pkg.repository.full_name;
  if (pkgRepo !== repoFullName) return;

  console.log(`*** Package: ${pkg.name} (${pkg.id})`);

  const versions = await listPackageVersions(octokit, packageType, pkg.name, ownerType, owner);

  let toDelete;
  try {
    toDelete = selectVersionsToDelete(versions, alwaysKeepRegex, versionsToKeep);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  if (toDelete.length === 0) {
    console.log(`nothing to delete; keeping latest ${versionsToKeep}`);
    return;
  }

  for (const v of toDelete) {
    if (dryRun) {
      console.log(`[dry-run] would delete version ${v.name} (id ${v.id})`);
    } else {
      console.log(`deleting version ${v.name} (id ${v.id}) ...`);
      try {
        await deletePackageVersion(octokit, packageType, pkg.name, v.id, ownerType, owner);
        console.log("deleted");
      } catch (err) {
        console.error(`failed to delete version ${v.name}: ${err}`);
      }
    }
  }
}

async function run() {
  const token = getInput("token", true);
  const repoFullName = getInput("repoFullName", true);
  const packageType = getInput("packageType", true);
  const versionsToKeep = Number(getInput("versionsToKeep")) || 2;
  const alwaysKeepRegex = getInput("alwaysKeepRegex") || null;
  const dryRun = getInput("dryRun") === true || getInput("dryRun") === "true";

  const octokit = new Octokit({ auth: token });

  console.log(`delete-snapshots: repo=${repoFullName} packageType=${packageType} versionsToKeep=${versionsToKeep} alwaysKeepRegex=${alwaysKeepRegex} dryRun=${dryRun}`);
  console.log("determining repository type...");
  const [owner, repoName] = repoFullName.split("/");
  const repoInfo = await octokit.rest.repos.get({ owner, repo: repoName });
  const ownerTypeRaw = repoInfo.data.owner.type; // 'User' or 'Organization'
  const ownerType = ownerTypeRaw === 'Organization' ? 'orgs' : 'users';

  console.log("fetching packages...");
  const packages = await listPackages(octokit, packageType, ownerType, owner);

  for (const pkg of packages) {
    await processPackage(
      octokit,
      pkg,
      repoFullName,
      packageType,
      versionsToKeep,
      alwaysKeepRegex,
      dryRun,
      ownerType,
      owner
    );
  }
}

// only execute when run as a script (not when imported for tests)
const entrypoint = fileURLToPath(import.meta.url);
if (process.argv[1] && process.argv[1] === entrypoint) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

// exports for testing or external usage
export { listPackages, listPackageVersions, deletePackageVersion, selectVersionsToDelete, processPackage, run };