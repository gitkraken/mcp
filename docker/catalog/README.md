# Docker MCP Catalog submission

This directory contains the source template for the GitKraken entry in
[`docker/mcp-registry`](https://github.com/docker/mcp-registry).

To prepare a registry pull request:

1. Copy `server.yaml.template` to `servers/gitkraken/server.yaml` in a checkout
   of `docker/mcp-registry`.
2. Replace `<PINNED_COMMIT_SHA>` with the full commit SHA containing the
   Dockerfile being submitted.
3. Copy the repository root `tools.json` next to `server.yaml`.
4. Add the approved GitKraken authentication configuration once its
   non-interactive container contract is finalized.
5. Confirm that the license declared by the distributed `@gitkraken/gk`
   package is acceptable for Docker Catalog redistribution.
6. Run the registry's `task build -- --tools gitkraken` and
   `task catalog -- gitkraken` checks before opening the pull request.

The `paths` parameter is intentionally required because the local Git tools
must only receive access to repositories explicitly selected by the user.
