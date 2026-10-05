$shell = New-Object -ComObject Shell.Application
$computer = $shell.Namespace(17)
$phone = $computer.Items() | Where-Object { $_.Name -match "S26|Jacob|twentySix|Galaxy|Phone" } | Select-Object -First 1
$internalStorage = $phone.GetFolder.Items() | Where-Object { $_.Name -match "Internal storage|Phone|Storage" } | Select-Object -First 1
$downloadFolder = $internalStorage.GetFolder.Items() | Where-Object { $_.Name -eq "Download" } | Select-Object -First 1

Write-Host "Folder: " $downloadFolder.Name
$destFolder = $downloadFolder.GetFolder

# Copy file
$source = "c:\Users\freem\Documents\letsPlayATX\android\app\build\outputs\apk\debug\app-debug.apk"
Write-Host "Copying $source..."
$destFolder.CopyHere($source, 16)
Write-Host "Copy command issued"
