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
    MATHEMATICAL OBJECTIVE FUNCTION FOR BISECTION METHOD:
    Evaluates: f(v) = T_die(v) - T_target = 0
    
    Parameters:
      :param v: Airflow velocity from the cooling fan (m/s)
      :param Q: Internal heat dissipated by the CPU silicon die (Watts = 45.0 W)
      :param T_amb: Room ambient temperature (Newton's cooling floor = 25.0 °C)
      :param T_target: Target safe maximum operating junction temperature (70.0 °C)
      
    Role of 'h' (Convective Heat Transfer Coefficient):
      According to Newton's Law of Cooling: Heat transfer rate q = h * A * (T - T_amb).
      The coefficient 'h' measures how efficiently moving air pulls thermal energy
      away from the copper heatsink fins. Faster air velocity (v) increases turbulence,
      which dramatically increases 'h'.
    """
    # -------------------------------------------------------------------------
    # STEP 1: Calculate Convective Heat Transfer Coefficient 'h'
    # Empirical correlation for forced convection through micro-fin heat sinks:
    # h(v) = h_natural + c_forced * (v^0.8)
    # Units of h: Watts per square meter per Kelvin (W / m^2 · K)
    # -------------------------------------------------------------------------
    h_nat = 10.0       # Natural baseline air convection (W/m²·K) when fan is stationary
    c_forced = 45.0    # Forced convective turbulence factor (W·s^0.8 / m^2.8·K)
    area = 0.065       # Total effective copper heatsink fin surface area (m²)
    r_silicon = 0.38   # Internal conduction resistance through silicon die & thermal paste (°C/W)

    # Total convective coefficient h as a non-linear function of fan speed 'v':
    h_total = h_nat + c_forced * (v ** 0.8)

    # -------------------------------------------------------------------------
    # STEP 2: Convert Heat Transfer Coefficient 'h' to Thermal Resistance (R_conv)
    # R_conv = 1 / (h * Area) [Units: °C/Watt]
    # Higher 'h' directly causes LOWER thermal resistance, cooling the CPU!
    # -------------------------------------------------------------------------
    r_conv = 1.0 / (h_total * area)
    
    # Total resistance from silicon core die to room ambient air:
    r_total = r_silicon + r_conv

    # -------------------------------------------------------------------------
    # STEP 3: Compute Steady-State CPU Die Junction Temperature
    # T_die = T_ambient + (Power * Resistance) [Ohm's Law equivalent for heat]
    # -------------------------------------------------------------------------
    t_die = T_amb + Q * r_total

    # Return residue error: If f(v) > 0, CPU is overheating; if f(v) < 0, CPU is overcooled
    return t_die - T_target


def optimize_cooling_bisection(a=0.1, b=8.0, tol=1e-4, max_iter=50):
    """
    ALGORITHM: BOLZANO'S BISECTION ROOT-FINDING METHOD
    
    Mathematical Principle:
      1. Choose initial interval [a, b] such that f(a) * f(b) < 0 (opposite signs).
      2. By the Intermediate Value Theorem, a continuous function MUST cross zero
         at least once in (a, b).
      3. At every iteration, compute the midpoint: m = (a + b) / 2.
      4. Halve the search interval depending on whether f(a) * f(m) < 0 or > 0.
      5. Error after k iterations is guaranteed: error_k <= (b - a) / (2^k).
    """
    # Evaluate function at the boundaries of the interval
    fa = thermal_objective_function(a)  # Fan at 0.1 m/s (Idle) -> Overheating (+43.2°C)
    fb = thermal_objective_function(b)  # Fan at 8.0 m/s (Max)  -> Overcooling (-12.4°C)

    print("=" * 70)
    print("      BISECTION METHOD ROOT-FINDING COOLING OPTIMIZATION")
    print("=" * 70)
    print(f" Search Interval: [{a:.2f}, {b:.2f}] m/s | Tolerance: {tol:.1e}")
    print(f" f(a) = {fa:+.4f} °C (Fan idle: CPU is overheating, f(a) > 0)")
    print(f" f(b) = {fb:+.4f} °C (Fan maximum: CPU is overcooled, f(b) < 0)")

    # Bolzano's Theorem Condition Check: f(a) and f(b) MUST have opposite signs!
    if fa * fb >= 0:
        raise ValueError("Intermediate Value Theorem violated: f(a) and f(b) must have opposite signs!")

    # Calculate theoretical maximum iterations required to achieve tolerance 'tol'
    expected_iters = math.ceil(math.log2((b - a) / tol))
    print(f" Theoretical Iterations Required: N = ⌈log₂((b-a)/ε)⌉ = {expected_iters}")
    print("-" * 70)
    print(f"{'Iter':<5} | {'a (Lower)':<9} | {'b (Upper)':<9} | {'Midpoint (v*)':<13} | {'f(mid) (°C)':<12} | {'Interval Width':<14}")
    print("-" * 70)

    history = []
    # -------------------------------------------------------------------------
    # ITERATION LOOP: HALVING THE SEARCH SPACE
    # -------------------------------------------------------------------------
    for k in range(1, max_iter + 1):
        # 1. Compute Midpoint: m = (a + b) / 2
        mid = 0.5 * (a + b)
        
        # 2. Evaluate objective function at the midpoint
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

        print(f"{k:<5} | {a:<9.4f} | {b:<9.4f} | {mid:<13.4f} | {f_mid:<+12.5f} | {width:<14.6f}")

        # 3. Check Convergence Criterion:
        # If absolute error is smaller than tolerance (10^-4), stop immediately!
        if abs(f_mid) < tol or (width / 2.0) < tol:
            print("-" * 70)
            print(f"[SUCCESS] Converged in {k} iterations using Bisection Method!")
            print(f"  --> Optimal Fan Airflow Velocity v* = {mid:.4f} m/s")
            print(f"  --> Predicted CPU Die Temperature   = {70.0 + f_mid:.3f} °C (Target: 70.00 °C)")
            print("=" * 70)
            return mid, history

        # 4. Bolzano Interval Reduction:
        # If f(a) and f(mid) have opposite signs, root is in the left half [a, mid]
        if fa * f_mid < 0:
            b = mid
            fb = f_mid
        # Otherwise, root is in the right half [mid, b]
        else:
            a = mid
            fa = f_mid

    return 0.5 * (a + b), history


if __name__ == '__main__':
    opt_v, steps = optimize_cooling_bisection()
