param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Repair-Text {
  param([AllowNull()][string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
  $trimmed = $Text.Trim()
  try {
    $bytes = [System.Text.Encoding]::GetEncoding(1252).GetBytes($trimmed)
    $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)
    if ($fixed -match '[\u00C0-\u017F]' -or $fixed -match 'ç|ã|á|é|í|ó|ú|â|ê|ô|õ|à') {
      return $fixed.Trim()
    }
  } catch {
    # Keep original when conversion is not possible.
  }
  return $trimmed
}

function Normalize-Label {
  param([AllowNull()][string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return '' }
  $fixed = Repair-Text $Text
  $normalized = $fixed.Normalize([Text.NormalizationForm]::FormD)
  $normalized = [regex]::Replace($normalized, '\p{Mn}+', '')
  $normalized = $normalized.ToLowerInvariant()
  $normalized = $normalized -replace '[^a-z0-9]+', ' '
  return ($normalized.Trim() -replace '\s+', ' ')
}

function To-Value {
  param(
    [AllowNull()][string]$Raw,
    [switch]$AsDate,
    [switch]$AsNumber
  )
  if ([string]::IsNullOrWhiteSpace($Raw)) { return $null }
  $value = (Repair-Text $Raw)
  if ([string]::IsNullOrWhiteSpace($value)) { return $null }

  if ($AsDate) {
    $trim = $value.Trim()
    if ($trim -match '^\d+(\.\d+)?$') {
      try {
        $num = 0.0
        if (-not [double]::TryParse($trim, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$num)) {
          $fallback = $trim -replace ',', '.'
          [void][double]::TryParse($fallback, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$num)
        }
        if ($num -le 0) { return $null }
        $date = [DateTime]::FromOADate($num)
        return $date.ToString('yyyy-MM-dd')
      } catch {}
    }
    if ($trim -match '^(\d{1,2})/(\d{1,2})/(\d{4})$') {
      try {
        return ([DateTime]::ParseExact($trim, 'd/M/yyyy', [System.Globalization.CultureInfo]::InvariantCulture)).ToString('yyyy-MM-dd')
      } catch {}
    }
    if ($trim -match '^(\d{4})-(\d{2})-(\d{2})$') { return $trim }
    return $null
  }

  if ($AsNumber) {
    $trim = $value.Trim()
    $parsed = 0.0
    if ([double]::TryParse($trim, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) { return $parsed }
    $normalized = $trim -replace ',', '.'
    if ([double]::TryParse($normalized, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) { return $parsed }
    return $null
  }

  return $value
}

function Get-CellValue {
  param(
    [System.Xml.XmlElement]$Cell,
    [System.Xml.XmlNamespaceManager]$Ns,
    [string[]]$SharedStrings
  )

  $cellType = [string]$Cell.GetAttribute('t')
  $valueNode = $Cell.SelectSingleNode('./x:v', $Ns)
  if (-not $valueNode) {
    $inlineNode = $Cell.SelectSingleNode('./x:is/x:t', $Ns)
    if ($inlineNode) { return Repair-Text $inlineNode.InnerText }
    return $null
  }

  $raw = [string]$valueNode.InnerText
  if ($cellType -eq 's') {
    $index = [int]$raw
    if ($index -ge 0 -and $index -lt $SharedStrings.Count) {
      return Repair-Text $SharedStrings[$index]
    }
    return $null
  }

  return Repair-Text $raw
}

function Build-CellMap {
  param(
    [string]$SheetFile,
    [string[]]$SharedStrings
  )
  $xml = [xml](Get-Content -Raw -Path $SheetFile)
  $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
  $ns.AddNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
  $map = @{}
  foreach ($cell in $xml.SelectNodes('//x:sheetData/x:row/x:c', $ns)) {
    $ref = [string]$cell.GetAttribute('r')
    if ([string]::IsNullOrWhiteSpace($ref)) { continue }
    $map[$ref] = Get-CellValue -Cell $cell -Ns $ns -SharedStrings $SharedStrings
  }
  return $map
}

function Find-RowByALabel {
  param(
    [hashtable]$CellMap,
    [string]$LabelLike,
    [string]$LabelColumn = 'A',
    [int]$MinRow = 1,
    [int]$MaxRow = 220
  )
  $target = Normalize-Label $LabelLike
  if (-not $target) { return $null }
  $labelCol = if ([string]::IsNullOrWhiteSpace($LabelColumn)) { 'A' } else { $LabelColumn.Trim().ToUpperInvariant() }
  for ($row = $MinRow; $row -le $MaxRow; $row++) {
    $ref = "$labelCol$row"
    if (-not $CellMap.ContainsKey($ref)) { continue }
    $current = Normalize-Label ([string]$CellMap[$ref])
    if (-not $current) { continue }
    if ($current -eq $target -or $current -like "*$target*") {
      return $row
    }
    $tokens = @(
      $target.Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries) `
        | Where-Object { $_.Length -ge 4 } `
        | ForEach-Object { $_.Substring(0, [Math]::Min(5, $_.Length)) }
    )
    if ($tokens.Count -gt 0) {
      $allMatch = $true
      foreach ($token in $tokens) {
        if ($current -notlike "*$token*") {
          $allMatch = $false
          break
        }
      }
      if ($allMatch) { return $row }
    }
  }
  return $null
}

function Get-ByLabel {
  param(
    [hashtable]$CellMap,
    [string]$LabelLike,
    [string]$LabelColumn = 'A',
    [string]$Column = 'B',
    [int]$MinRow = 1,
    [int]$MaxRow = 220,
    [switch]$AsDate,
    [switch]$AsNumber
  )
  $row = Find-RowByALabel -CellMap $CellMap -LabelLike $LabelLike -LabelColumn $LabelColumn -MinRow $MinRow -MaxRow $MaxRow
  if (-not $row) { return $null }
  $ref = "$Column$row"
  $raw = if ($CellMap.ContainsKey($ref)) { [string]$CellMap[$ref] } else { $null }
  return To-Value -Raw $raw -AsDate:$AsDate -AsNumber:$AsNumber
}

function New-Inconsistency {
  param([string]$field, [string]$raw, [string]$reason)
  return [pscustomobject]@{
    field = $field
    raw_value = $raw
    reason = $reason
  }
}

if (-not (Test-Path -LiteralPath $InputPath)) {
  throw "Arquivo nao encontrado: $InputPath"
}

$tempDir = Join-Path $env:TEMP ("laines_xlsx_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($InputPath, $tempDir)

  $sharedStrings = @()
  $sharedPath = Join-Path $tempDir 'xl/sharedStrings.xml'
  if (Test-Path -LiteralPath $sharedPath) {
    $sharedXml = [xml](Get-Content -Raw -Path $sharedPath)
    $nsShared = New-Object System.Xml.XmlNamespaceManager($sharedXml.NameTable)
    $nsShared.AddNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    foreach ($si in $sharedXml.SelectNodes('//x:si', $nsShared)) {
      $text = ''
      foreach ($t in $si.SelectNodes('.//x:t', $nsShared)) {
        $text += [string]$t.InnerText
      }
      $sharedStrings += (Repair-Text $text)
    }
  }

  $workbookXml = [xml](Get-Content -Raw -Path (Join-Path $tempDir 'xl/workbook.xml'))
  $relsXml = [xml](Get-Content -Raw -Path (Join-Path $tempDir 'xl/_rels/workbook.xml.rels'))

  $nsWb = New-Object System.Xml.XmlNamespaceManager($workbookXml.NameTable)
  $nsWb.AddNamespace('x', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
  $nsWb.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')

  $nsRels = New-Object System.Xml.XmlNamespaceManager($relsXml.NameTable)
  $nsRels.AddNamespace('r', 'http://schemas.openxmlformats.org/package/2006/relationships')

  $targetSheets = @(
    'ANA JULYA',
    'REBECA',
    'CAUA',
    'MARCOS VINICIUS',
    'ERICK',
    'RAFAEL',
    'ELIEZER',
    'FRANCKLEY',
    'RENAN'
  )

  $athletes = @()
  foreach ($sheetNode in $workbookXml.SelectNodes('//x:sheets/x:sheet', $nsWb)) {
    $sheetName = [string]$sheetNode.GetAttribute('name')
    if ($sheetName -eq 'MODELO_ATLETA') { continue }
    if ($targetSheets -notcontains $sheetName) { continue }

    $rid = [string]$sheetNode.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $relNode = $relsXml.SelectSingleNode("//r:Relationship[@Id='$rid']", $nsRels)
    if (-not $relNode) { continue }

    $target = [string]$relNode.GetAttribute('Target')
    $sheetFile = Join-Path $tempDir ('xl/' + $target)
    if (-not (Test-Path -LiteralPath $sheetFile)) { continue }

    $map = Build-CellMap -SheetFile $sheetFile -SharedStrings $sharedStrings
    $issues = @()

    $coxaRaw = Get-ByLabel -CellMap $map -LabelLike 'Coxa (maior perimetro)' -Column 'B'
    $pantRaw = Get-ByLabel -CellMap $map -LabelLike 'Panturrilha (maior perimetro)' -LabelColumn 'E' -Column 'F'
    $obsRaw = if ($map.ContainsKey('B26')) { [string]$map['B26'] } else { $null }
    $imcClassRaw = if ($map.ContainsKey('H37')) { [string]$map['H37'] } else { $null }

    $athlete = [ordered]@{
      sheet_name = $sheetName
      identificacao = [ordered]@{
        nome = Get-ByLabel -CellMap $map -LabelLike 'Nome' -Column 'B'
        sexo = Get-ByLabel -CellMap $map -LabelLike 'Sexo (M/F)' -Column 'B'
        data_avaliacao = Get-ByLabel -CellMap $map -LabelLike 'Data da avaliacao' -LabelColumn 'E' -Column 'F' -AsDate
        idade = Get-ByLabel -CellMap $map -LabelLike 'Idade' -Column 'B' -AsNumber
        tempo_treino = Get-ByLabel -CellMap $map -LabelLike 'Tempo de treino' -LabelColumn 'E' -Column 'F'
        categoria = Get-ByLabel -CellMap $map -LabelLike 'Categoria' -Column 'B'
        modalidade_prova = Get-ByLabel -CellMap $map -LabelLike 'Modalidade / Prova' -LabelColumn 'E' -Column 'F'
        clube_treinador = Get-ByLabel -CellMap $map -LabelLike 'Clube / Treinador' -LabelColumn 'E' -Column 'F'
      }
      medidas_basicas = [ordered]@{
        peso_kg = Get-ByLabel -CellMap $map -LabelLike 'Peso' -Column 'B' -AsNumber
        estatura_m = Get-ByLabel -CellMap $map -LabelLike 'Estatura' -LabelColumn 'E' -Column 'F' -AsNumber
        cintura_cm = Get-ByLabel -CellMap $map -LabelLike 'Cintura' -Column 'B' -AsNumber
        quadril_cm = Get-ByLabel -CellMap $map -LabelLike 'Quadril' -LabelColumn 'E' -Column 'F' -AsNumber
        pescoco_cm = Get-ByLabel -CellMap $map -LabelLike 'Pescoco' -Column 'B' -AsNumber
        braco_relaxado_cm = Get-ByLabel -CellMap $map -LabelLike 'Braco relaxado' -LabelColumn 'E' -Column 'F' -AsNumber
        coxa_maior_perimetro_cm = To-Value -Raw $coxaRaw
        panturrilha_maior_perimetro_cm = To-Value -Raw $pantRaw
      }
      dobras_cutaneas = [ordered]@{
        peitoral_mm = Get-ByLabel -CellMap $map -LabelLike 'Peitoral' -Column 'B' -MinRow 18 -MaxRow 26 -AsNumber
        axilar_media_mm = Get-ByLabel -CellMap $map -LabelLike 'Axilar media' -Column 'B' -MinRow 18 -MaxRow 26 -AsNumber
        triceps_mm = Get-ByLabel -CellMap $map -LabelLike 'Triceps' -Column 'B' -MinRow 18 -MaxRow 26 -AsNumber
        subescapular_mm = Get-ByLabel -CellMap $map -LabelLike 'Subescapular' -Column 'B' -MinRow 18 -MaxRow 26 -AsNumber
        abdominal_mm = Get-ByLabel -CellMap $map -LabelLike 'Abdominal' -LabelColumn 'E' -Column 'F' -MinRow 18 -MaxRow 26 -AsNumber
        suprailiaca_mm = Get-ByLabel -CellMap $map -LabelLike 'Suprailiaca' -LabelColumn 'E' -Column 'F' -MinRow 18 -MaxRow 26 -AsNumber
        coxa_mm = Get-ByLabel -CellMap $map -LabelLike 'Coxa' -LabelColumn 'E' -Column 'F' -MinRow 18 -MaxRow 26 -AsNumber
        supraespinal_extra_mm = Get-ByLabel -CellMap $map -LabelLike 'Supraespinal (extra)' -Column 'B' -MinRow 18 -MaxRow 26 -AsNumber
        panturrilha_dobra_extra_mm = Get-ByLabel -CellMap $map -LabelLike 'Panturrilha (dobra extra)' -LabelColumn 'E' -Column 'F' -MinRow 18 -MaxRow 26 -AsNumber
      }
      observacoes = [ordered]@{
        observacoes_avaliador = To-Value -Raw (
          @(
            $obsRaw
            if ($map.ContainsKey('B26')) { [string]$map['B26'] }
            if ($map.ContainsKey('B27')) { [string]$map['B27'] }
            if ($map.ContainsKey('B28')) { [string]$map['B28'] }
          ) -join ' '
        )
      }
      bioimpedancia = [ordered]@{
        gordura_bia_percentual = Get-ByLabel -CellMap $map -LabelLike '% Gordura (BIA)' -Column 'B' -MinRow 30 -MaxRow 34 -AsNumber
        massa_magra_bia_kg = Get-ByLabel -CellMap $map -LabelLike 'Massa magra (BIA)' -LabelColumn 'E' -Column 'F' -MinRow 30 -MaxRow 34 -AsNumber
        massa_gorda_bia_kg = Get-ByLabel -CellMap $map -LabelLike 'Massa gorda (BIA)' -Column 'B' -MinRow 30 -MaxRow 34 -AsNumber
        agua_corporal_bia_percentual = Get-ByLabel -CellMap $map -LabelLike 'Agua corporal (BIA)' -LabelColumn 'E' -Column 'F' -MinRow 30 -MaxRow 34 -AsNumber
        angulo_fase = Get-ByLabel -CellMap $map -LabelLike 'Angulo de fase' -Column 'B' -MinRow 30 -MaxRow 34 -AsNumber
        tmb_bia_kcal_dia = Get-ByLabel -CellMap $map -LabelLike 'TMB (BIA)' -LabelColumn 'E' -Column 'F' -MinRow 30 -MaxRow 34 -AsNumber
        resistencia_ohm = Get-ByLabel -CellMap $map -LabelLike 'Resistencia' -Column 'B' -MinRow 30 -MaxRow 34 -AsNumber
        reatancia_ohm = Get-ByLabel -CellMap $map -LabelLike 'Reatancia' -LabelColumn 'E' -Column 'F' -MinRow 30 -MaxRow 34 -AsNumber
      }
      resultados_automaticos = [ordered]@{
        soma_7_dobras_jp7 = Get-ByLabel -CellMap $map -LabelLike '7 Dobras (JP7)' -Column 'B' -MinRow 36 -MaxRow 42 -AsNumber
        densidade_corporal_jp7 = Get-ByLabel -CellMap $map -LabelLike 'Densidade corporal (JP7)' -Column 'B' -MinRow 36 -MaxRow 42 -AsNumber
        gordura_percentual_siri = Get-ByLabel -CellMap $map -LabelLike '% Gordura (Siri)' -LabelColumn 'E' -Column 'F' -MinRow 36 -MaxRow 42 -AsNumber
        massa_gorda_dobras_kg = Get-ByLabel -CellMap $map -LabelLike 'Massa gorda (dobras)' -Column 'B' -MinRow 36 -MaxRow 42 -AsNumber
        massa_magra_dobras_kg = Get-ByLabel -CellMap $map -LabelLike 'Massa magra (dobras)' -LabelColumn 'E' -Column 'F' -MinRow 36 -MaxRow 42 -AsNumber
        ffmi = Get-ByLabel -CellMap $map -LabelLike 'FFMI' -Column 'B' -MinRow 36 -MaxRow 42 -AsNumber
        imc = Get-ByLabel -CellMap $map -LabelLike 'IMC' -LabelColumn 'E' -Column 'F' -MinRow 36 -MaxRow 42 -AsNumber
        classificacao_imc = To-Value -Raw $imcClassRaw
        whr = Get-ByLabel -CellMap $map -LabelLike 'WHR (cintura/quadril)' -LabelColumn 'E' -Column 'F' -MinRow 36 -MaxRow 42 -AsNumber
      }
      raw_values = [ordered]@{
        coxa_maior_perimetro_raw = $coxaRaw
        panturrilha_maior_perimetro_raw = $pantRaw
      }
      inconsistencias = @()
    }

    if (-not $athlete.identificacao.nome) {
      $issues += (New-Inconsistency -field 'identificacao.nome' -raw '' -reason 'nome ausente')
    }
    if (-not $athlete.identificacao.data_avaliacao) {
      $rawDate = Get-ByLabel -CellMap $map -LabelLike 'Data da avaliacao' -LabelColumn 'E' -Column 'F'
      $issues += (New-Inconsistency -field 'identificacao.data_avaliacao' -raw ([string]$rawDate) -reason 'data invalida ou ausente')
    }
    if ($coxaRaw -and -not ($coxaRaw -match '^\d+([.,]\d+)?$')) {
      $issues += (New-Inconsistency -field 'medidas_basicas.coxa_maior_perimetro_cm' -raw $coxaRaw -reason 'valor textual com lateralidade')
    }
    if ($pantRaw -and -not ($pantRaw -match '^\d+([.,]\d+)?$')) {
      $issues += (New-Inconsistency -field 'medidas_basicas.panturrilha_maior_perimetro_cm' -raw $pantRaw -reason 'valor textual com lateralidade')
    }

    $athlete.inconsistencias = $issues
    $athletes += [pscustomobject]$athlete
  }

  $outDir = Split-Path -Parent $OutputPath
  if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
  }

  $payload = [pscustomobject]@{
    source_file = $InputPath
    generated_at = (Get-Date).ToString('s')
    athletes_found = $athletes.Count
    athletes = $athletes
  }

  $payload | ConvertTo-Json -Depth 15 | Set-Content -Path $OutputPath -Encoding UTF8
  Write-Output $OutputPath
} finally {
  if (Test-Path -LiteralPath $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
  }
}
