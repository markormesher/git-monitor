import { exec } from "child_process";
import { promises as fs } from "fs";
import * as http from "http";

interface IProject {
  readonly name: string;
  readonly path: string;
}

interface IConfig {
  readonly projects: IProject[];
}

enum RepoStatus {
  PathNotFound = "Path does not exist",
  NotAGitRepo = "Not a git repo",
  NoCommitsYet = "No commits yet",
  UntrackedFiles = "Untracked files",
  UncommittedChanges = "Uncommitted changes",
  UnpushedChanges = "Ahead of remote branch",
  UnpulledChanges = "Behind remote branch",
  Okay = "Okay!",
  UnknownError = "Unknown Error",
}

function getStatusIconName(status: RepoStatus): string {
  switch(status) {
    case RepoStatus.PathNotFound:
      return "fa-exclamation-circle";
    case RepoStatus.NotAGitRepo:
      return "fa-exclamation-circle";
    case RepoStatus.NoCommitsYet:
      return "fa-baby";
    case RepoStatus.UntrackedFiles:
      return "fa-search";
    case RepoStatus.UncommittedChanges:
      return "fa-pencil-alt";
    case RepoStatus.UnpushedChanges:
      return "fa-exchange-alt fa-rotate-90";
    case RepoStatus.UnpulledChanges:
      return "fa-exchange-alt fa-rotate-90";
    case RepoStatus.Okay:
      return "fa-check-circle";
    default:
      return "fa-exclamation-circle";
  }
}

function getStatusTextClass(status: RepoStatus): string {
  switch(status) {
    case RepoStatus.PathNotFound:
      return "has-text-danger";
    case RepoStatus.NotAGitRepo:
      return "has-text-danger";
    case RepoStatus.NoCommitsYet:
      return "has-text-warning";
    case RepoStatus.UntrackedFiles:
      return "has-text-warning";
    case RepoStatus.UncommittedChanges:
      return "has-text-warning";
    case RepoStatus.UnpushedChanges:
      return "has-text-warning";
    case RepoStatus.UnpulledChanges:
      return "has-text-warning";
    case RepoStatus.Okay:
      return "has-text-success";
    default:
      return "has-text-danger";
  }
}

async function execAsync(command: string): Promise<{ stdout: string, stderr: string, error?: string }> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => resolve({ stdout, stderr, error: error?.message }));
  });
}

async function getRepoStatus(path: string): Promise<RepoStatus> {
  // outcomes are ordered most-to-least serious

  const env = "GIT_DISCOVERY_ACROSS_FILESYSTEM=true";
  const gitCmd = `git -C "${path}"`;

  const existsCheck = await execAsync(`ls "${path}"`);
  if (existsCheck.stderr?.indexOf("No such file or directory") >= 0) {
    return RepoStatus.PathNotFound;
  }

  const logCheck = await execAsync(`${env} ${gitCmd} log -1`);

  if (logCheck.stderr.indexOf("not a git repository") >= 0) {
    return RepoStatus.NotAGitRepo;
  }

  if (logCheck.stderr.indexOf("does not have any commits") >= 0) {
    return RepoStatus.NoCommitsYet;
  }

  const statusCheck = await execAsync(`${env} ${gitCmd} status --porcelain=v1`);
  const statuses = statusCheck.stdout.trim().split("\n").map((line) => line.substr(0, 2));

  if (statuses.indexOf("??") >= 0) {
    return RepoStatus.UntrackedFiles;
  }

  if (statuses.length > 1) {
    return RepoStatus.UncommittedChanges;
  }

  const countAhead = parseInt((await execAsync(`${env} ${gitCmd} rev-list --count @{u}..HEAD`)).stdout);

  if (countAhead > 0) {
    return RepoStatus.UnpushedChanges;
  }

  const countBehind = parseInt((await execAsync(`${env} ${gitCmd} rev-list --count HEAD..@{u}`)).stdout);

  if (countBehind > 0) {
    return RepoStatus.UnpulledChanges;
  }

  return RepoStatus.Okay;
}

function renderOutput(results: [IProject, RepoStatus][]): string {
  let output = `
<html>
<head>
<title>Git Monitor</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bulma/0.9.3/css/bulma.min.css" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
<style type="text/css">.icon-text { align-items: center; }</style>
</head>
<body>
<div class="section">
<div class="container">
<h1 class="title">Git Monitor</h1>
<div class="columns is-multiline">
`;

  for (const [project, status] of results) {
    output += `
<div class="column is-one-third">
  <div class="card">
    <div class="card-content">
      <div class="icon-text">
        <span class="icon is-large ${getStatusTextClass(status)}">
          <i class="fas fa-2x ${getStatusIconName(status)}"></i>
        </span>
        <span class="title is-4 ${getStatusTextClass(status)}">${project.name}</span>
      </div>
      <p class="content block">${status}</p>
    </div>
  </div>
</div>
`;
  }

  output += `
</div>
</div>
</div>
</body>
</html>
`;

  return output;
}

(async function() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.log(`Usage: node ${process.argv[1]} PATH_TO_CONFIG`);
    return;
  }

  const configPath = args[0];
  const config: IConfig = JSON.parse((await fs.readFile(configPath)).toString());

  if (!config.projects || config.projects.length === 0) {
    console.log("Config must include one or more project");
    return;
  }

  for (const project of config.projects) {
    if (!project.path || !project.name) {
      console.log("One or more projects was missing a name or path parameter");
      return;
    }
  }

  console.log("Config read okay!");

  const requestListener: http.RequestListener = async (request, response) => {
    const statuses: [IProject, RepoStatus][] = await Promise.all(config.projects.map(async (project) => {
      try {
        const status = await getRepoStatus(project.path);
        return [project, status] as [IProject, RepoStatus];
      } catch (error) {
        return [project, RepoStatus.UnknownError] as [IProject, RepoStatus];
      }
    }));

    response.setHeader("Content-Type", "text/html");
    response.writeHead(200);
    response.end(renderOutput(statuses));
  };

  const server = http.createServer(requestListener);
  server.listen(3000);
})();
