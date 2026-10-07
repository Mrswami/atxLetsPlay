$inputDir = "public\assets\avatars"
$outputDir = "public\assets\characters_v1"

if (-Not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir
}

$images = Get-ChildItem -Path $inputDir -Filter "*.jpg"

foreach ($img in $images) {
    $outPath = Join-Path $outputDir $img.Name
    Write-Host "Generating v2 for $($img.Name)..."
    .\openart.exe generate image "A 3D video game character selection portrait, extremely unique, highly detailed, expressive retro aesthetic. Solid clean background, no environment, no background details." --model byte-plus-seedream-5-lite --image $img.FullName -o $outPath --yes
}
