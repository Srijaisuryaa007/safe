# Ralph Wiggum - Long-running AI agent loop (PowerShell for Windows)
# Usage: .\ralph.ps1 [-Tool claude|amp] [-MaxIterations 10]

param (
    [ValidateSet("claude", "amp")]
    [string]$Tool = "claude",
    [int]$MaxIterations = 10
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PrdFile = Join-Path $ScriptDir "prd.json"
$ProgressFile = Join-Path $ScriptDir "progress.txt"
$ArchiveDir = Join-Path $ScriptDir "archive"
$LastBranchFile = Join-Path $ScriptDir ".last-branch"

# Archive previous run if branch changed
if ((Test-Path $PrdFile) -and (Test-Path $LastBranchFile)) {
    try {
        $prdContent = Get-Content $PrdFile -Raw | ConvertFrom-Json
        $currentBranch = $prdContent.branchName
        $lastBranch = (Get-Content $LastBranchFile -Raw).Trim()
        
        if ($currentBranch -and $lastBranch -and ($currentBranch -ne $lastBranch)) {
            $dateStr = (Get-Date).ToString("yyyy-MM-dd")
            $folderName = $lastBranch -replace '^ralph/', ''
            $archiveFolder = Join-Path $ArchiveDir "$dateStr-$folderName"
            
            Write-Host "Archiving previous run: $lastBranch"
            New-Item -ItemType Directory -Path $archiveFolder -Force | Out-Null
            if (Test-Path $PrdFile) { Copy-Item $PrdFile $archiveFolder }
            if (Test-Path $ProgressFile) { Copy-Item $ProgressFile $archiveFolder }
            Write-Host "   Archived to: $archiveFolder"
            
            Set-Content -Path $ProgressFile -Value "# Ralph Progress Log`nStarted: $(Get-Date)`n---`n"
        }
    } catch {
        Write-Warning "Could not parse previous branch metadata: $_"
    }
}

# Track current branch
if (Test-Path $PrdFile) {
    try {
        $prdContent = Get-Content $PrdFile -Raw | ConvertFrom-Json
        if ($prdContent.branchName) {
            Set-Content -Path $LastBranchFile -Value $prdContent.branchName
        }
    } catch {}
}

# Initialize progress file if it doesn't exist
if (-not (Test-Path $ProgressFile)) {
    Set-Content -Path $ProgressFile -Value "# Ralph Progress Log`nStarted: $(Get-Date)`n---`n"
}

Write-Host "Starting Ralph - Tool: $Tool - Max iterations: $MaxIterations" -ForegroundColor Cyan

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor Yellow
    Write-Host "  Ralph Iteration $i of $MaxIterations ($Tool)" -ForegroundColor Yellow
    Write-Host "===============================================================" -ForegroundColor Yellow

    $output = ""
    if ($Tool -eq "amp") {
        $promptText = Get-Content (Join-Path $ScriptDir "prompt.md") -Raw
        $output = $promptText | amp --dangerously-allow-all 2>&1 | Tee-Object -Variable capturedOutput
    } else {
        $promptFile = Join-Path $ScriptDir "CLAUDE.md"
        $output = Get-Content $promptFile -Raw | claude --dangerously-skip-permissions --print 2>&1 | Tee-Object -Variable capturedOutput
    }

    $combinedOutput = ($capturedOutput | Out-String)
    if ($combinedOutput -match "<promise>COMPLETE</promise>") {
        Write-Host ""
        Write-Host "Ralph completed all tasks!" -ForegroundColor Green
        Write-Host "Completed at iteration $i of $MaxIterations" -ForegroundColor Green
        exit 0
    }

    Write-Host "Iteration $i complete. Continuing..." -ForegroundColor Gray
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "Ralph reached max iterations ($MaxIterations) without completing all tasks." -ForegroundColor Red
Write-Host "Check $ProgressFile for status." -ForegroundColor Yellow
exit 1
