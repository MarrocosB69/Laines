import math


def calc_usnavy(
    neck_cm: float,
    waist_cm: float,
    hip_cm: float | None,
    height_cm: float,
    peso_kg: float,
    sexo: str,
) -> dict:
    """
    US Navy body composition formula.

    Male:
        %BF = 495 / (1.0324 − 0.19077·log10(waist − neck) + 0.15456·log10(height)) − 450

    Female:
        %BF = 495 / (1.29579 − 0.35004·log10(waist + hip − neck) + 0.22100·log10(height)) − 450

    All measurements in cm.
    """
    try:
        if sexo == 'feminino':
            if not hip_cm or hip_cm <= 0:
                raise ValueError('Quadril e obrigatorio para a formula feminina')
            arg = waist_cm + hip_cm - neck_cm
            if arg <= 0:
                raise ValueError('Soma cintura+quadril−pescoço deve ser positiva')
            body_fat = (
                495.0
                / (1.29579 - 0.35004 * math.log10(arg) + 0.22100 * math.log10(height_cm))
                - 450.0
            )
        elif sexo == 'masculino':
            diff = waist_cm - neck_cm
            if diff <= 0:
                raise ValueError('Cintura deve ser maior que o pescoço')
            body_fat = (
                495.0
                / (1.0324 - 0.19077 * math.log10(diff) + 0.15456 * math.log10(height_cm))
                - 450.0
            )
        else:
            raise ValueError('Sexo biologico nao suportado pela formula')
    except (ValueError, ZeroDivisionError) as exc:
        return {'error': str(exc), 'percGordura': None, 'massaGorda': None, 'massaMagra': None, 'rcq': None}

    if not math.isfinite(body_fat) or body_fat < 2.0 or body_fat > 70.0:
        return {
            'error': 'Resultado fora da faixa fisiologicamente plausivel',
            'percGordura': None,
            'massaGorda': None,
            'massaMagra': None,
            'rcq': None,
        }
    massa_gorda = round(peso_kg * body_fat / 100.0, 2)
    massa_magra = round(peso_kg - massa_gorda, 2)
    rcq = round(waist_cm / hip_cm, 3) if hip_cm else None

    return {
        'percGordura': round(body_fat, 1),
        'massaGorda': massa_gorda,
        'massaMagra': massa_magra,
        'rcq': rcq,
    }
