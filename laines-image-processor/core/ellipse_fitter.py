import math
import numpy as np


def fit_weighted_ellipse(
    theta_arr: list[float],
    radius_arr: list[float],
    weight_arr: list[float],
) -> tuple[float, float]:
    """
    Fit a weighted ellipse to polar radius measurements.

    Body cross-section is modeled as an ellipse in polar form:
        r(θ)² = a²·sin²θ + b²·cos²θ

    where:
        a = semi-axis front-to-back (depth)
        b = semi-axis side-to-side (width)

    This is linear in [a², b²]:
        sin²(θ)·a² + cos²(θ)·b² = r²

    Solved via weighted least squares: W·X·[a², b²]ᵀ = W·r²
    """
    theta = np.asarray(theta_arr, dtype=float)
    r = np.asarray(radius_arr, dtype=float)
    w = np.asarray(weight_arr, dtype=float)

    if len(theta) < 2:
        mean_r = float(np.average(r, weights=w)) if len(r) > 0 else 10.0
        return mean_r, mean_r

    sin2 = np.sin(theta) ** 2
    cos2 = np.cos(theta) ** 2

    X = np.column_stack([sin2, cos2])
    Y = r ** 2

    sqrt_w = np.sqrt(np.maximum(w, 0.0))
    Xw = X * sqrt_w[:, np.newaxis]
    Yw = Y * sqrt_w

    coeffs, *_ = np.linalg.lstsq(Xw, Yw, rcond=None)
    a_sq, b_sq = float(coeffs[0]), float(coeffs[1])

    # Guard against negative values caused by noise
    a = math.sqrt(max(0.5, a_sq))
    b = math.sqrt(max(0.5, b_sq))

    return a, b  # (depth, width) both in cm


def ramanujan_circumference(a: float, b: float) -> float:
    """
    Ramanujan's second-order approximation for ellipse perimeter.
    Accurate to < 0.02% for any a/b ratio.
    """
    if a <= 0 or b <= 0:
        return 0.0
    h = ((a - b) ** 2) / ((a + b) ** 2)
    return math.pi * (a + b) * (1.0 + (3.0 * h) / (10.0 + math.sqrt(4.0 - 3.0 * h)))
