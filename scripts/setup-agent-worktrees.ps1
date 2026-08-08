$ErrorActionPreference = "Stop"

$root = (git rev-parse --show-toplevel).Trim()
if (-not $root) {
    throw "This script must be run from inside the Supreme Git repository."
}

$originUrl = (git remote get-url origin).Trim()
if (-not $originUrl) {
    throw "Unable to determine origin remote URL."
}

$originLeaf = ($originUrl -replace '\\', '/' -split '/')[-1]
$repoName = [System.IO.Path]::GetFileNameWithoutExtension($originLeaf)
if (-not $repoName) {
    throw "Unable to determine repository name from origin remote URL: $originUrl"
}

$parent = Split-Path -Parent $root
$codexDir = Join-Path $parent "$repoName-codex"
$claudeDir = Join-Path $parent "$repoName-claude"

Push-Location $root
try {
    Write-Host "Fetching origin..."
    git fetch origin
    if ($LASTEXITCODE -ne 0) {
        throw "git fetch origin failed."
    }

    function Ensure-Worktree {
        param(
            [Parameter(Mandatory = $true)][string]$Path,
            [Parameter(Mandatory = $true)][string]$Branch,
            [Parameter(Mandatory = $true)][string]$Label
        )

        if (Test-Path -LiteralPath $Path) {
            Write-Host "Skipping $Label worktree: $Path already exists."
            return
        }

        git show-ref --verify --quiet "refs/heads/$Branch"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Creating $Label worktree from existing branch $Branch at $Path"
            git worktree add $Path $Branch
        }
        else {
            Write-Host "Creating $Label worktree at $Path"
            git worktree add $Path -b $Branch origin/main
        }

        if ($LASTEXITCODE -ne 0) {
            throw "Failed to create $Label worktree."
        }
    }

    Ensure-Worktree -Path $codexDir -Branch "codex/workspace" -Label "Codex"
    Ensure-Worktree -Path $claudeDir -Branch "claude/workspace" -Label "Claude"

    Write-Host ""
    Write-Host "Agent worktrees are ready:"
    Write-Host "  Main:   $root"
    Write-Host "  Codex:  $codexDir"
    Write-Host "  Claude: $claudeDir"
    Write-Host ""
    Write-Host "Recommended usage:"
    Write-Host "  Set-Location '$codexDir'; codex"
    Write-Host "  Set-Location '$claudeDir'; claude"
    Write-Host ""
    Write-Host "For real tasks, create a task-specific branch from origin/main instead of reusing the workspace branch indefinitely."
}
finally {
    Pop-Location
}
