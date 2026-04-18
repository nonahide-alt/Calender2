# Simple HTTP Server in PowerShell using .NET HttpListener
$port = 8080
$path = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Server running at http://localhost:$port"
Write-Host "Serving from: $path"
Write-Host "Press Ctrl+C to stop."

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $response = $context.Response
        $request = $context.Request

        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ($urlPath -eq "") {
            $urlPath = "index.html"
        }

        $filePath = Join-Path -Path $path -ChildPath $urlPath

        if (Test-Path $filePath -PathType Leaf) {
            $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mimeType = switch ($extension) {
                ".html" { "text/html" }
                ".css"  { "text/css" }
                ".js"   { "application/javascript" }
                ".json" { "application/json" }
                ".csv"  { "text/csv" }
                ".ico"  { "image/x-icon" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                default { "application/octet-stream" }
            }

            $response.ContentType = $mimeType
            
            try {
                $content = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $content.Length
                $response.OutputStream.Write($content, 0, $content.Length)
                Write-Host "200 OK: $urlPath" -ForegroundColor Green
            } catch {
                $response.StatusCode = 500
                Write-Host "500 Internal Error: $urlPath" -ForegroundColor Red
            }
        } else {
            $response.StatusCode = 404
            Write-Host "404 Not Found: $urlPath" -ForegroundColor Yellow
        }

        $response.Close()
    }
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
