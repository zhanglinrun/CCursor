# Read-only GitHub REST queries using the existing gh login and Windows system proxy.
param(
    [string]$Endpoint = 'rate_limit',
    [string]$Jq
)

$ErrorActionPreference = 'Stop'
if ($Endpoint -notmatch '^[A-Za-z0-9][A-Za-z0-9._~/%?=&:+,\-]*$' -or $Endpoint.Contains('://')) {
    throw 'Use a GitHub API relative path, such as repos/vastsa/PI-Desktop. URLs and options are not accepted.'
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI is required. Install gh and run gh auth login first.'
}

$previousProxy = [Environment]::GetEnvironmentVariable('HTTPS_PROXY')
try {
    # Go/gh does not automatically use the Windows proxy that PowerShell uses.
    if (-not $previousProxy -and $IsWindows) {
        $target = [Uri]'https://api.github.com'
        $proxy = [System.Net.WebRequest]::DefaultWebProxy.GetProxy($target)
        if ($proxy -and $proxy.AbsoluteUri -ne $target.AbsoluteUri) {
            $env:HTTPS_PROXY = $proxy.AbsoluteUri
        }
    }
    $arguments = @('api', '--hostname', 'github.com', '--method', 'GET', $Endpoint)
    if ($Jq) {
        $arguments += @('--jq', $Jq)
    }
    & gh @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub API query failed ($LASTEXITCODE). Check gh auth status and the API reset time; no credentials were changed."
    }
}
finally {
    if ($null -eq $previousProxy) {
        Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue
    }
    else {
        $env:HTTPS_PROXY = $previousProxy
    }
}
