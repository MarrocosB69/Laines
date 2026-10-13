# Procedimento de validação — calibração ArUco

## Objetivo

Verificar que a calibração por marcador ArUco produz circunferências medidas
com erro ≤ 5 % em relação a uma medida de referência (fita métrica).

O critério de ±5 % é alcançável quando o deslocamento em profundidade (Δd)
entre o marcador e a seção transversal medida satisfaz Δd ≤ D × 0,05, onde D
é a distância câmera-alvo. A D = 2 m → Δd ≤ 10 cm. Com mais cuidado no
posicionamento (Δd ≤ 5 cm), a D = 2 m → erro ≤ 2,5 %.

---

## Material necessário

| Item | Especificação |
|---|---|
| Objeto cilíndrico | Rolo de PVC ou lata grande; circunferência medida com fita de aço (referência) |
| Marcador ArUco | `DICT_4X4_50`, ID 0, lado físico 14,8 cm, impresso em papel sulfite 75 g/m² |
| Haste de suporte | Bastão rígido ou tripé de foto; altura regulável |
| Câmera | Mesmo dispositivo usado nas avaliações (celular traseiro) |
| Fundo | Parede clara, sem padrões geométricos |

---

## Geração do marcador

```python
import cv2

dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
marker = cv2.aruco.generateImageMarker(dictionary, id=0, sidePixels=600)
cv2.imwrite('aruco_DICT4X4_50_id0_14.8cm.png', marker)
```

Imprima sem redimensionar ("tamanho real") em folha A4. Meça o lado impresso
com régua metálica e anote o valor real em `arucoMarkerSizeCm`. Se houver
discrepância ≥ 1 mm, use o valor medido (não o nominal).

---

## Montagem

```
[câmera]  ←— D ≈ 2 m —→  [cilindro]  [haste com marcador ArUco]
                              ↑                   ↑
                        seção a medir       plano do marcador
                                          (face voltada para câmera)
```

- O marcador deve ficar ao lado do cilindro, **virado para a câmera**
  (paralelo ao plano do sensor).
- O plano do marcador deve coincidir com o centro da seção medida no eixo Z
  para que Δd ≈ 0. Na prática, manter Δd ≤ 10 cm.
- Altura da haste: centro do marcador na mesma altura da seção transversal
  mais crítica (cintura).

---

## Capturas

Fotografar o cilindro + marcador nas 4 poses do protocolo, reposicionando a
haste para que o marcador **sempre fique voltado para a câmera**:

| Vista | θ (°) | Posição da haste |
|---|---|---|
| Frontal | 0 | À esquerda do cilindro, face ao norte (câmera ao norte) |
| Lateral direita | 90 | À frente do cilindro, face ao oeste |
| Posterior | 180 | À direita do cilindro, face ao sul |
| Lateral esquerda | 270 | Atrás do cilindro, face ao leste |

Para o vídeo 360°, a haste permanece fixa (ex.: à esquerda, face frontal). O
pipeline derivará a escala do vídeo a partir da mediana das escalas das 4
fotos — nenhum marcador precisa estar visível no vídeo.

---

## Processamento

```bash
# Processar as 4 fotos + vídeo com o pipeline normal
# Verificar no resultado:
#   calibracao.metodo_geral  → deve ser 'aruco'
#   calibracao.confianca_geral → deve ser 'alta'
```

---

## Critérios de aceite

| Métrica | Critério |
|---|---|
| Circunferência estimada vs. fita (cintura) | erro < 5 % |
| Circunferência estimada vs. fita (pescoço) | erro < 5 % |
| `calibracao.confianca_geral` | `'alta'` |
| `calibracao.metodo_geral` | `'aruco'` |
| `cv_ratio` de cada foto | < 0,15 |

---

## Checklist de causas de erro > 5 %

- [ ] Marcador não está paralelo à câmera (alto `cv_ratio`)
- [ ] `arucoMarkerSizeCm` não corrigido após impressão
- [ ] Δd (deslocamento em profundidade) > 10 cm a D = 2 m
- [ ] Marcador estava na sombra ou com reflexo (baixa detecção)
- [ ] opencv-contrib-python não instalado → fallback por estatura

---

## Limitações conhecidas

1. **Erro de profundidade**: scale error ≈ Δd/D. A D = 2 m, Δd = 20 cm → 10 %
   de erro. Para ±5 %, manter Δd ≤ 10 cm.

2. **Vídeo usa escala fixa das fotos**: assume distância câmera constante
   entre fotos e vídeo. Variações de posição do avaliador invalidam a
   suposição.

3. **Marcador não visível no vídeo**: estratégia (a) — escala derivada das
   fotos — é a escolhida. Não há detecção por frame no vídeo.

4. **opencv-contrib-python obrigatório**: `opencv-python-headless` não inclui
   `cv2.aruco`. Se ausente, todas as avaliações caem no fallback por estatura
   e o sistema registra `confianca_geral: 'baixa'`.
