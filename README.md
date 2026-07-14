# GitKraken MCP Server

The GitKraken MCP Server turns your AI assistant into a context-aware development partner by connecting it to git history, branches, issues, pull requests, and multi-repo workflows through GitKraken. It works with all the providers you would expect from the GitKraken software suite such as GitHub, GitLab, Azure DevOps, Bitbucket, Jira and more. Built by the team behind GitLens, the Git tool that 48 million developers chose, from first-time contributors to enterprise teams at Netflix and Adobe.

The GitKraken MCP Server is available on macOS, Windows, and Linux systems and works in VS Code, Cursor, Windsurf, Claude Desktop, Kiro, JetBrains, and more.

If you want to read more about the MCP server, you can check out the [introductory blog post](https://www.gitkraken.com/blog/introducing-gitkraken-mcp).

## Table of Contents

- [Tools](#tools)
- [Prompts](#prompts)
- [Installation](#installation)
- [Troubleshooting](#troubleshooting)
- [Support](#support)

## Tools

Tools are the primary purpose of the MCP server. They are a set of finely curated commands that AI can use to interact with GitKraken without exploding your context. Some of those tools include: `issues_assigned_to_me`, `gitlens_commit_composer`, and `pull_request_create_review`. A full list of tools can be found in the GitKraken Help Center's [Tools Reference](https://help.gitkraken.com/mcp/mcp-tools-reference/).

The repository also includes a Docker MCP Catalog-compatible [`tools.json`](tools.json). To refresh it from the local GitKraken CLI, run:

```bash
node scripts/generate-tools-json.mjs
```

## Prompts

Prompts are the secondary purpose of the MCP server. They are a set of carefully crafted instructions that AI can use to understand how to use the tools, when to use them, and what information to provide when using them. A full list of prompts can be found in the GitKraken Help Center's [Prompts Reference](https://help.gitkraken.com/mcp/mcp-prompts-reference/).

## Installation

There are a few ways of installing the MCP server. Regardless of which installation method you choose, you may still need to configure your AI tools to work with the MCP server. You can find a set of instructions on the Help Center's [MCP Getting Started guide](https://help.gitkraken.com/mcp/mcp-getting-started/).

### GitLens

GitLens is by far the easiest way of installing the MCP server. Simply download and install GitLens into a supported IDE (VS Code, Cursor, etc) and the MCP server will be installed alongside it. Once you have GitLens installed, you can start using the tools right away.

### NPM

You can also install and use the MCP server via [npm](https://www.npmjs.com/). You can find the [package on the npm registry](https://www.npmjs.com/package/@gitkraken/gk).

The installation process details may vary by AI tool, but the general gist is that you will replace the MCP server JSON config with something that looks like this:

```json
{
  "mcpServers": {
    "GitKraken": {
      "args": ["@gitkraken/gk", "mcp"],
      "command": "npx",
      "type": "stdio"
    }
  }
}
```

### CLI

#### macOS

`gk` is available from [Homebrew](https://formulae.brew.sh/cask/gitkraken-cli) with the following command:

Homebrew:

```bash
brew install gitkraken-cli
```

Or download it from the [releases page](https://github.com/gitkraken/gk-cli/releases) and add it to your binaries folder:

```bash
mv ~/Downloads/gk /usr/local/bin/gk
```

---

#### Linux / Ubuntu

[![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/gitkraken-cli)

`gk` is available as a downloadable binary from the [releases page](https://github.com/gitkraken/gk-cli/releases). Once you have it, add it to your binaries folder:

```bash
mv ~/Downloads/gk /usr/local/bin/gk
```

Or create a new directory, move the binary and add it to $PATH:

```bash
mkdir "$HOME/cli"
mv ~/Downloads/gk "$HOME/cli"
export PATH="$HOME/gk:$PATH"
```

You can also [download][releases page] your corresponding package (`.deb`, `.rpm`) and install it with:

```bash
sudo apt install ./gk.deb
```

or

```bash
sudo rpm -i ./gk.rpm
```

---

#### Windows

`gk` is available from [Winget][winget] with the following command:

```bash
winget install gitkraken.cli
```

## Troubleshooting

### gk from Oh-My-Zsh

If you installed the `gitkraken-cli` and are using Oh-My-Zsh you can run into a small aliasing issue. Oh-My-Zsh has `gitk` aliased as `gk` by default and that can create some problems. To fix this, type in your terminal:

```bash
unalias gk
```

## Support

If you run into any issues, double check if we have the problem covered in our [Help Center](https://help.gitkraken.com/mcp/mcp-getting-started/).

You can give feedback and report bugs on GitHub by [submitting an issue](https://github.com/gitkraken/gk-cli/issues/new?template=bug_report.yml).

If you would like to reach out to Support directly, you can [submit a ticket](https://gitkraken.com/contact)
