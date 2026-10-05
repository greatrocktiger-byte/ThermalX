"""
=================================================================================
THERMALX — MULTI-RUN TEMPERATURE DRIFT & ΔT SENSITIVITY ANALYZER
=================================================================================
Course Mapping: Computational Mathematics / Parametric Numerical Experiments
Objective:      Track steady-state temperature evolution across multiple consecutive
                experimental runs and plot the differential heat distribution:
                ΔT(x,y) = T_current(x,y) - T_previous(x,y)
=================================================================================
"""

import sys
import numpy as np
import matplotlib.pyplot as plt

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from thermal_solver import ThermalGrid2D


def run_parametric_drift_experiment(save_path="delta_t_analysis_dashboard.png"):
    """
    Executes 4 sequential experimental runs mimicking user slider adjustments:
      Run 1: Standard Baseline (CPU: 85°C, GPU: 75°C, Fan: 50%)
      Run 2: Heavy Gaming / Overclock (CPU: 96°C, GPU: 86°C, Fan: 50%) [Thermal Surge]
      Run 3: Active Turbo Fan Boost (CPU: 96°C, GPU: 86°C, Fan: 90%) [Cooling Benefit]
      Run 4: Eco Silent Mode (CPU: 72°C, GPU: 62°C, Fan: 35%) [Power Reduction]
    """
    experiments = [
        {'name': 'Run 1: Baseline', 'cpu': 85.0, 'gpu': 75.0, 'cooling': 0.50},
        {'name': 'Run 2: Overclock Load', 'cpu': 96.0, 'gpu': 86.0, 'cooling': 0.50},
        {'name': 'Run 3: Turbo Fan Boost', 'cpu': 96.0, 'gpu': 86.0, 'cooling': 0.90},
        {'name': 'Run 4: Eco Silent Mode', 'cpu': 72.0, 'gpu': 62.0, 'cooling': 0.35}
    ]

    print("=" * 75)
    print("      MULTI-RUN TEMPERATURE DRIFT & ΔT COMPARATIVE EXPERIMENT")
    print("=" * 75)

    results = []
    grids = []

    for i, exp in enumerate(experiments):
        print(f"\n--> Simulating {exp['name']} (CPU: {exp['cpu']}°C, Fan: {int(exp['cooling']*100)}%)...")
        grid_obj = ThermalGrid2D(rows=40, cols=40)
        # Update heat sources
        for s in grid_obj.sources:
            if 'CPU' in s['name']:
                s['target_temp'] = exp['cpu']
            elif 'GPU' in s['name']:
                s['target_temp'] = exp['gpu']

        # Adjust cooling boundary
        for cz in grid_obj.cooling_zones:
            cz['sink_temp'] = 25.0 + (1.0 - exp['cooling']) * 12.0

        res = grid_obj.solve_gauss_seidel(max_iter=400, tol=1e-3)
        T = res['grid']
        grids.append(T)

        max_t = float(np.max(T))
        avg_t = float(np.mean(T))

        prev_max = results[-1]['max_temp'] if results else max_t
        prev_avg = results[-1]['avg_temp'] if results else avg_t
        delta_max = max_t - prev_max
        delta_avg = avg_t - prev_avg

        results.append({
            'run_num': i + 1,
            'name': exp['name'],
            'max_temp': max_t,
            'avg_temp': avg_t,
            'delta_max': delta_max,
            'delta_avg': delta_avg,
            'sweeps': res['iterations']
        })

        sign_str = f"+{delta_max:.2f}°C" if delta_max >= 0 else f"{delta_max:.2f}°C"
        print(f"    Peak Temp: {max_t:.1f}°C | ΔT vs Previous: {sign_str} | Iterations: {res['iterations']}")

    # -----------------------------------------------------------------
    # PLOT DUAL-PANEL COMPARATIVE DASHBOARD
    # -----------------------------------------------------------------
    plt.style.use('dark_background')
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6.5), dpi=150)
    fig.patch.set_facecolor('#070b16')

    for ax in (ax1, ax2):
        ax.set_facecolor('#0d1424')
        ax.tick_params(colors='#8899ac', labelsize=9)
        for sp in ax.spines.values():
            sp.set_color('#1e293b')

    # PANEL 1: MULTI-RUN TEMPERATURE DRIFT LINE GRAPH T(run)
    run_names = [f"Run {r['run_num']}\n({r['name'].split(':')[1].strip()})" for r in results]
    x_indices = np.arange(len(results))
    max_temps = [r['max_temp'] for r in results]
    avg_temps = [r['avg_temp'] for r in results]

    ax1.plot(x_indices, max_temps, color='#ef4444', linewidth=2.5, marker='o', markersize=8, label='Peak Silicon Temp (°C)')
    ax1.plot(x_indices, avg_temps, color='#00f0ff', linewidth=2.0, marker='s', markersize=7, label='Chassis Avg Temp (°C)')

    # Add Delta Badges above points
    for idx, r in enumerate(results):
        d = r['delta_max']
        if idx == 0:
            txt = f"{r['max_temp']:.1f}°C\n(Base)"
            color = '#38bdf8'
        else:
            arrow = "▲ +" if d >= 0 else "▼ "
            txt = f"{r['max_temp']:.1f}°C\n({arrow}{d:.1f}°)"
            color = '#ef4444' if d > 0 else '#10b981'

        ax1.annotate(txt, (x_indices[idx], max_temps[idx]), textcoords="offset points",
                     xytext=(0, 14), ha='center', fontsize=8.5, weight='bold', color=color,
                     bbox=dict(boxstyle='round,pad=0.3', facecolor='#050811', edgecolor=color, alpha=0.9))

    ax1.set_xticks(x_indices)
    ax1.set_xticklabels(run_names, color='#cbd5e1', fontsize=8.5)
    ax1.set_ylabel("Temperature (°C)", color='#8899ac', fontsize=10)
    ax1.set_title("1. Run-to-Run Temperature Evolution & ΔT Drift Curve", color='#ffffff', fontsize=11, weight='bold', pad=12)
    ax1.grid(True, linestyle=':', alpha=0.25, color='#ffffff')
    ax1.legend(facecolor='#0d1424', edgecolor='#1e293b', labelcolor='#ffffff', fontsize=9)
    ax1.set_ylim(min(avg_temps) - 8, max(max_temps) + 16)

    # PANEL 2: 2D DIFFERENTIAL HEATMAP (T_Run3 - T_Run2: Fan Boost Cooling Effect)
    # Shows where the turbo fan cooled down the chassis
    diff_grid = grids[2] - grids[1]
    limit = max(abs(np.min(diff_grid)), abs(np.max(diff_grid)))

    im2 = ax2.imshow(diff_grid, cmap='coolwarm', vmin=-limit, vmax=limit, origin='upper')
    cbar2 = plt.colorbar(im2, ax=ax2, fraction=0.046, pad=0.04)
    cbar2.set_label('ΔT Temperature Difference (°C)', color='#38bdf8', fontsize=10, weight='bold')
    cbar2.ax.tick_params(colors='#8899ac')

    ax2.set_title("2. Differential Heatmap ΔT(x,y) = Run 3 (Turbo) - Run 2 (Hot)", color='#ffffff', fontsize=11, weight='bold', pad=12)
    ax2.set_xlabel("Chassis X Nodes", color='#8899ac', fontsize=9)
    ax2.set_ylabel("Chassis Y Nodes", color='#8899ac', fontsize=9)

    plt.suptitle("THERMALX — RUN-TO-RUN TEMPERATURE COMPARISON & ΔT DRIFT ENGINE",
                 color='#ffffff', fontsize=13, weight='bold', y=0.98)
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.savefig(save_path, facecolor=fig.get_facecolor(), edgecolor='none', dpi=150)
    plt.close()
    print(f"\n[SUCCESS] Exported ΔT comparison dashboard to: {save_path}")
    print("=" * 75)


if __name__ == '__main__':
    run_parametric_drift_experiment("delta_t_analysis_dashboard.png")
