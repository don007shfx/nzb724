# Renders the NZB-7/24 launcher icon at every Android density.
#
# The mark is drawn programmatically (no external assets): a dark control-room
# tile with the acid-lime "7/24" brand block, matching src/styles/app.css.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\make-icons.ps1

Add-Type -AssemblyName System.Drawing

$res = Join-Path $PSScriptRoot '..\android\app\src\main\res'
$res = (Resolve-Path $res).Path

$bgDark = [System.Drawing.Color]::FromArgb(255, 11, 14, 19)
$accent = [System.Drawing.Color]::FromArgb(255, 201, 247, 74)
$ink = [System.Drawing.Color]::FromArgb(255, 10, 13, 6)

function New-RoundedPath([System.Drawing.RectangleF]$rect, [single]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $radius * 2
  $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
  $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
  $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-Mark([int]$size, [bool]$transparentBackground, [bool]$circular) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  $scale = $size / 1024.0

  if (-not $transparentBackground) {
    if ($circular) {
      $g.FillEllipse((New-Object System.Drawing.SolidBrush($bgDark)), 0, 0, $size, $size)
    } else {
      $radius = 190 * $scale
      $path = New-RoundedPath (New-Object System.Drawing.RectangleF(0, 0, $size, $size)) $radius
      $g.FillPath((New-Object System.Drawing.SolidBrush($bgDark)), $path)
    }
  }

  # Lime block. For adaptive icons the safe zone is the central 66/108, so the
  # block is drawn smaller and the launcher mask never clips it.
  if ($transparentBackground) {
    $blockSize = 560 * $scale
  } else {
    $blockSize = 660 * $scale
  }
  $offset = ($size - $blockSize) / 2
  $blockRadius = $blockSize * 0.22
  $block = New-RoundedPath (New-Object System.Drawing.RectangleF($offset, $offset, $blockSize, $blockSize)) $blockRadius
  $g.FillPath((New-Object System.Drawing.SolidBrush($accent)), $block)

  # "7/24" centred inside the block, mono to match the in-app brand mark.
  # The size is fitted to a measured width so the digits never spill past the
  # lime block (where dark ink would be invisible against the dark tile).
  $family = $null
  foreach ($name in 'Consolas', 'Cascadia Mono', 'Courier New') {
    try {
      $candidate = New-Object System.Drawing.FontFamily($name)
      $family = $candidate
      break
    } catch { }
  }
  if (-not $family) { $family = (New-Object System.Drawing.FontFamily('Arial')) }

  $targetWidth = $blockSize * 0.74
  $fontSize = $blockSize * 0.44
  $font = New-Object System.Drawing.Font($family, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $measured = $g.MeasureString('7/24', $font, 10000, [System.Drawing.StringFormat]::GenericTypographic)
  if ($measured.Width -gt 0) {
    $fontSize = $fontSize * ($targetWidth / $measured.Width)
    $font.Dispose()
    $font = New-Object System.Drawing.Font($family, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  }

  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $format.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
  $textRect = New-Object System.Drawing.RectangleF($offset, $offset, $blockSize, $blockSize)
  $g.DrawString('7/24', $font, (New-Object System.Drawing.SolidBrush($ink)), $textRect, $format)

  $font.Dispose()
  $g.Dispose()
  return $bmp
}

function Save-Icon([System.Drawing.Bitmap]$bitmap, [string]$folder, [string]$name) {
  $dir = Join-Path $res $folder
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $target = Join-Path $dir $name
  $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host ("  {0}\{1}  {2}x{3}" -f $folder, $name, $bitmap.Width, $bitmap.Height)
}

# density -> legacy launcher size, adaptive foreground size
$densities = [ordered]@{
  'mipmap-mdpi'    = @(48, 108)
  'mipmap-hdpi'    = @(72, 162)
  'mipmap-xhdpi'   = @(96, 216)
  'mipmap-xxhdpi'  = @(144, 324)
  'mipmap-xxxhdpi' = @(192, 432)
}

foreach ($folder in $densities.Keys) {
  $legacy = $densities[$folder][0]
  $adaptive = $densities[$folder][1]

  $square = New-Mark $legacy $false $false
  Save-Icon $square $folder 'ic_launcher.png'
  $square.Dispose()

  $round = New-Mark $legacy $false $true
  Save-Icon $round $folder 'ic_launcher_round.png'
  $round.Dispose()

  $foreground = New-Mark $adaptive $true $false
  Save-Icon $foreground $folder 'ic_launcher_foreground.png'
  $foreground.Dispose()
}

# Splash: solid brand background so the WebView does not flash white.
$splashColors = @{
  'drawable'             = @(480, 800)
  'drawable-land-mdpi'   = @(480, 320)
  'drawable-land-hdpi'   = @(800, 480)
  'drawable-land-xhdpi'  = @(1280, 720)
  'drawable-land-xxhdpi' = @(1600, 960)
  'drawable-land-xxxhdpi'= @(1920, 1280)
  'drawable-port-mdpi'   = @(320, 480)
  'drawable-port-hdpi'   = @(480, 800)
  'drawable-port-xhdpi'  = @(720, 1280)
  'drawable-port-xxhdpi' = @(960, 1600)
  'drawable-port-xxxhdpi'= @(1280, 1920)
}

foreach ($folder in $splashColors.Keys) {
  $dims = $splashColors[$folder]
  $bmp = New-Object System.Drawing.Bitmap($dims[0], $dims[1], [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($bgDark)

  # Centred mark, sized to the short edge.
  $markSize = [int]([math]::Min($dims[0], $dims[1]) * 0.34)
  if ($markSize -ge 64) {
    $mark = New-Mark $markSize $false $false
    $g.DrawImage($mark, [int](($dims[0] - $markSize) / 2), [int](($dims[1] - $markSize) / 2), $markSize, $markSize)
    $mark.Dispose()
  }
  $g.Dispose()

  $dir = Join-Path $res $folder
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $bmp.Save((Join-Path $dir 'splash.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host ("  {0}\splash.png  {1}x{2}" -f $folder, $dims[0], $dims[1])
}

# The template's vector background/foreground would otherwise win on some API
# levels; point both at the generated raster icons.
$bgXml = Join-Path $res 'drawable\ic_launcher_background.xml'
if (Test-Path $bgXml) { Remove-Item -LiteralPath $bgXml -Force }

$bgColor = Join-Path $res 'values\ic_launcher_background.xml'
Set-Content -LiteralPath $bgColor -Encoding utf8 -Value @'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0B0E13</color>
</resources>
'@

Write-Host "Icons and splash screens written to $res"
