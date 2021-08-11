# Git Monitor

Git Monitor is a super-simple web dashboard to keep an eye on multiple git repos and show which ones have uncommitted changes, which are behind the remote branch, etc. I created this because I have a habit of tinkering with projects on a server then being lazy about committing the results to somewhere a little more permanent.

## Usage

### Mounted Files and Directories

Git Monitor requires to things to be mounted to the container as read-only volumes:

- A config file, mounted at `/config.json`.
- Each repo that you wish to monitor, mounted wherever you like.

Here's how to do that with Docker Compose:

```yaml
version: "3.8"
services:
  git-monitor:
    build: .
    volumes:
      - ${PWD}/config.json:/config.json:ro
      - ~/projects/git-monitor:/projects/git-monitor:ro
      - ~/documents/my-novel:/project/novel:ro
    ports:
      - 3000:3000
```

### Config File

Each mounted project needs to be defined in the config file in the following format:

```json
{
  "projects": [
    {
      "name": "Git Monitor",
      "path": "/projects/git-monitor"
    },
    {
      "name": "My Awesome Novel",
      "path": "/projects/novel"
    }
  ]
}
```

Note that the paths in the config file _must match their mount points in the container_, not the path on the host.

### Networking

The container listens on port 3000 for HTTP requests. All requests, regardless of path, will return the dashboard. It's recommended to use a reverse proxy like Nginx or Traefik to route requests to the container, handle HTTPS, etc.
