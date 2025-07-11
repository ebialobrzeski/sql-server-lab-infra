# === CONFIGURATION ===
$bucketName = "sql-lab-backup"
$keyName = "StackOverflow.bak"
$filePath = "C:/Work/GitHub/sql-server-training/assets/StackOverflow.bak"
$tempDir = "C:\Work\GitHub\sql-server-training\assets\TEMP\"
$partSize = 100MB
$uploadIdFile = "$tempDir\upload-id.txt"

# Ensure temp directory exists
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

# === INITIATE OR RESUME MULTIPART UPLOAD ===
if (Test-Path $uploadIdFile) {
    $uploadId = Get-Content $uploadIdFile
    Write-Host "🔁 Resuming multipart upload with ID: $uploadId"
} else {
    $response = aws-vault exec dil-team-dbops -- aws s3api create-multipart-upload `
        --bucket $bucketName --key $keyName
    $uploadId = ($response | ConvertFrom-Json).UploadId
    Set-Content $uploadIdFile $uploadId
    Write-Host "🚀 Started new multipart upload with ID: $uploadId"
}

# === FETCH ALREADY UPLOADED PARTS ===
Write-Host "🔍 Checking already uploaded parts..."
$uploadedParts = aws-vault exec dil-team-dbops -- aws s3api list-parts `
    --bucket $bucketName `
    --key $keyName `
    --upload-id $uploadId | ConvertFrom-Json
$completedPartNumbers = $uploadedParts.Parts.PartNumber
$parts = @()

foreach ($p in $uploadedParts.Parts) {
    $parts += @{ ETag = $p.ETag; PartNumber = $p.PartNumber }
}

# === UPLOAD MISSING PARTS ===
$splitFiles = Get-ChildItem "$tempDir\part*" | Sort-Object Name
$totalParts = $splitFiles.Count

for ($i = 0; $i -lt $totalParts; $i++) {
    $partNum = $i + 1
    $partFile = $splitFiles[$i].FullName

    if ($completedPartNumbers -contains $partNum) {
        Write-Host "✅ Skipping already uploaded part $partNum"
        continue
    }

    Write-Progress -Activity "Uploading part $partNum of $totalParts" -Status "Uploading..." -PercentComplete (($partNum / $totalParts) * 100)
    Write-Host "⬆ Uploading part $partNum..."

    $upload = aws-vault exec dil-team-dbops -- aws s3api upload-part `
        --bucket $bucketName `
        --key $keyName `
        --part-number $partNum `
        --upload-id $uploadId `
        --body $partFile

    $etag = ($upload | ConvertFrom-Json).ETag
    $parts += @{ ETag = $etag; PartNumber = $partNum }
}

# === COMPLETE MULTIPART UPLOAD ===

# Merge already uploaded + newly uploaded parts
$allParts = $parts | Sort-Object {[int]$_.PartNumber}

# Format to JSON structure
$completeJson = @{ Parts = $allParts } | ConvertTo-Json -Depth 3
$completeFile = "$tempDir\complete.json"

# Write JSON to file without BOM
[System.IO.File]::WriteAllText($completeFile, $completeJson, (New-Object System.Text.UTF8Encoding $false))

# Complete the multipart upload using the sorted JSON
aws-vault exec dil-team-dbops -- aws s3api complete-multipart-upload `
    --bucket $bucketName `
    --key $keyName `
    --upload-id $uploadId `
    --multipart-upload file://$completeFile

Write-Host "✅ Multipart upload completed successfully."
