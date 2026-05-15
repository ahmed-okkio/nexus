$Message = "Action Required: Please provide input."
if ($args.Count -gt 0) {
    $Message = $args[0]
}

[Console]::Error.WriteLine("Triggering notification with message: $Message")

Add-Type -AssemblyName System.Windows.Forms
$balloon = New-Object System.Windows.Forms.NotifyIcon
$balloon.Icon = [System.Drawing.SystemIcons]::Information
$balloon.BalloonTipTitle = "Gemini CLI"
$balloon.BalloonTipText = $Message
$balloon.Visible = $true
$balloon.ShowBalloonTip(5000)
Start-Sleep -Seconds 6
$balloon.Dispose()
[Console]::Error.WriteLine("Notification finished.")
