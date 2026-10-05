"""
=================================================================================
THERMALX — BISECTION ROOT-FINDING COOLING OPTIMIZER
=================================================================================
Course Mapping: Non-Linear Equations & Root-Finding Algorithms
Theorem:        Intermediate Value Theorem (Bolzano's Theorem)
Formula:
    If f(a) · f(b) < 0, a root exists in [a, b].
    Midpoint: m_k = (a_k + b_k) / 2
    Theoretical Iterations: N ≥ ⌈ log₂((b - a) / ε) ⌉

Engineering Application:
    Determines the exact active airflow velocity v* (m/s) required from the cooling
    fans so that the CPU die temperature does NOT exceed T_target (e.g., 70°C).
=================================================================================
"""

import math
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def thermal_objective_function(v, Q=45.0, T_amb=25.0, T_target=70.0):
    """
    Evaluates f(v) = T_die(v) - T_target.
    :param v: Airflow velocity (m/s)
    :param Q: Thermal heat generation (Watts)
    :param T_amb: Ambient room temperature (°C)
    :param T_target: Maximum safe target temperature (°C)
    """
    # Convective heat transfer: Fin stack effective area with 50 micro-fins (m²)
    h_nat = 10.0       # Natural convection baseline (W/m²·K)
    c_forced = 45.0    # Forced convection coefficient (W·s^0.8 / m^2.8·K)
    area = 0.065       # Effective copper fin stack surface area (0.065 m²)
    r_silicon = 0.38   # Silicon-to-heatpipe thermal interface resistance (°C/W)

    h_total = h_nat + c_forced * (v ** 0.8)
    r_conv = 1.0 / (h_total * area)
    r_total = r_silicon + r_conv

    # Operating junction temperature (°C)
    t_die = T_amb + Q * r_total
    return t_die - T_target


def optimize_cooling_bisection(a=0.1, b=8.0, tol=1e-4, max_iter=50):
    """
    Executes Bisection Method to find required airflow velocity v*.
    Returns full iteration step history for viva defense.
    """
    fa = thermal_objective_function(a)
    fb = thermal_objective_function(b)

    print("=" * 70)
    print("      BISECTION METHOD ROOT-FINDING COOLING OPTIMIZATION")
    print("=" * 70)
    print(f" Search Interval: [{a:.2f}, {b:.2f}] m/s | Tolerance: {tol:.1e}")
    print(f" f(a) = {fa:+.4f} °C (Fan too slow: Overheating)")
    print(f" f(b) = {fb:+.4f} °C (Fan high speed: Overcooling)")

    if fa * fb >= 0:
        raise ValueError("Intermediate Value Theorem violated: f(a) and f(b) must have opposite signs!")

    expected_iters = math.ceil(math.log2((b - a) / tol))
    print(f" Theoretical Iterations Required: N = ⌈log₂((b-a)/ε)⌉ = {expected_iters}")
    print("-" * 70)
    print(f"{'Iter':<5} | {'a':<8} | {'b':<8} | {'Midpoint (v*)':<13} | {'f(mid) (°C)':<12} | {'Interval Width':<14}")
    print("-" * 70)

    history = []
    for k in range(1, max_iter + 1):
        mid = 0.5 * (a + b)
        f_mid = thermal_objective_function(mid)
        width = b - a

        history.append({
            'iteration': k,
            'a': a,
            'b': b,
            'midpoint': mid,
            'f_mid': f_mid,
            'width': width
        })

        print(f"{k:<5} | {a:<8.4f} | {b:<8.4f} | {mid:<13.4f} | {f_mid:<+12.5f} | {width:<14.6f}")

        if abs(f_mid) < tol or (width / 2.0) < tol:
            print("-" * 70)
            print(f"[SUCCESS] Converged in {k} iterations!")
            print(f"  --> Optimal Fan Velocity v* = {mid:.4f} m/s")
            print(f"  --> Predicted Junction Temp = {70.0 + f_mid:.3f} °C (Target: 70.0 °C)")
            print("=" * 70)
            return mid, history

        if fa * f_mid < 0:
            b = mid
            fb = f_mid
        else:
            a = mid
            fa = f_mid

    return 0.5 * (a + b), history


if __name__ == '__main__':
    opt_v, steps = optimize_cooling_bisection()
