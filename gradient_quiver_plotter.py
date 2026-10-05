"""
=================================================================================
THERMALX — TEMPERATURE GRADIENT (∇T) & HEAT FLUX VECTOR QUIVER PLOTTER
=================================================================================
Course Mapping: Vector Calculus & PDEs in Engineering
Governing Law:  Fourier's Law of Heat Conduction:
                q = -k ∇T = -k [ (∂T/∂x) i + (∂T/∂y) j ]

Numerical Differentiation:
  - 2nd-Order Central Differences on Uniform Grid:
    (∂T/∂x)_{i,j} = (T_{i,j+1} - T_{i,j-1}) / (2·Δx)
    (∂T/∂y)_{i,j} = (T_{i+1,j} - T_{i-1,j}) / (2·Δy)
=================================================================================
"""

import sys
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from thermal_solver import ThermalGrid2D


def compute_thermal_gradients_and_flux(grid, dx=0.005, dy=0.005, k=150.0):
    """
    Computes spatial temperature gradient ∇T and Fourier heat flux vector field q.
    :param grid: 2D numpy array of temperatures (°C)
    :param dx, dy: Grid spacing in meters
    :param k: Thermal conductivity (W/m·K)
    :return: grad_y, grad_x, flux_y, flux_x, flux_mag
    """
    # 2nd-order central difference gradient
    grad_y, grad_x = np.gradient(grid, dy, dx)

    # Fourier's Law of Heat Conduction: q = -k ∇T
    flux_y = -k * grad_y
    flux_x = -k * grad_x
    flux_mag = np.hypot(flux_x, flux_y)

    return grad_y, grad_x, flux_y, flux_x, flux_mag


def plot_thermal_telemetry_dashboard(sim_grid_obj, save_path="thermal_telemetry_dashboard.png"):
    """
    Generates and saves the comprehensive 4-panel visual engineering dashboard:
      Panel 1: 2D Temperature Field Heatmap & Chip Layout
      Panel 2: Heat Flux Vector Field (Quiver Arrows: q = -k∇T) & Isothermal Contours
      Panel 3: 1D Spatial Cross-Section Slice T(x) across CPU Hotspot
      Panel 4: Residual Error Convergence Curves (Jacobi vs Gauss-Seidel)
    """
    print("\n[COMPUTING] Running Gauss-Seidel and Jacobi solvers...")
    res_gs = sim_grid_obj.solve_gauss_seidel(max_iter=500, tol=1e-3)
    res_j = sim_grid_obj.solve_jacobi(max_iter=500, tol=1e-3)

    T = res_gs['grid']
    rows, cols = T.shape
    grad_y, grad_x, flux_y, flux_x, flux_mag = compute_thermal_gradients_and_flux(
        T, sim_grid_obj.dx, sim_grid_obj.dy, sim_grid_obj.k
    )

    # Create Dark Cybernetic Telemetry Canvas
    plt.style.use('dark_background')
    fig, axes = plt.subplots(2, 2, figsize=(16, 12), dpi=150)
    fig.patch.set_facecolor('#070b16')

    for ax in axes.flat:
        ax.set_facecolor('#0d1424')
        ax.tick_params(colors='#8899ac', labelsize=9)
        for spine in ax.spines.values():
            spine.set_color('#1e293b')

    # -------------------------------------------------------------
    # PANEL 1: 2D TEMPERATURE HEATMAP WITH SILICON DIE BOUNDARIES
    # -------------------------------------------------------------
    ax1 = axes[0, 0]
    im1 = ax1.imshow(T, cmap='inferno', origin='upper', extent=[0, cols, rows, 0])
    cbar1 = plt.colorbar(im1, ax=ax1, fraction=0.046, pad=0.04)
    cbar1.set_label('Temperature (°C)', color='#00f0ff', fontsize=10, fontname='DejaVu Sans', weight='bold')
    cbar1.ax.tick_params(colors='#8899ac')

    # Draw hardware die footprints
    for src in sim_grid_obj.sources:
        w = src['c_end'] - src['c_start']
        h = src['r_end'] - src['r_start']
        rect = Rectangle((src['c_start'], src['r_start']), w, h,
                         linewidth=1.8, edgecolor='#00f0ff', facecolor='none', linestyle='--')
        ax1.add_patch(rect)
        ax1.text(src['c_start'] + 0.5, src['r_start'] - 0.7, src['name'].split()[0],
                 color='#00f0ff', fontsize=8, weight='bold')

    ax1.set_title("1. 2D Temperature Field T(x,y) & Silicon Dies", color='#ffffff', fontsize=11, weight='bold', pad=10)
    ax1.set_xlabel("Chassis Width (X Grid Cells)", color='#8899ac', fontsize=9)
    ax1.set_ylabel("Chassis Length (Y Grid Cells)", color='#8899ac', fontsize=9)

    # -------------------------------------------------------------
    # PANEL 2: HEAT FLUX QUIVER VECTOR FIELD (q = -k∇T) & ISOTHERMS
    # -------------------------------------------------------------
    ax2 = axes[0, 1]
    # Background subtle contour
    cs = ax2.contour(T, levels=[35, 50, 65, 80], colors=['#00f0ff', '#10b981', '#f59e0b', '#ef4444'],
                     linewidths=1.2, extent=[0, cols, rows, 0])
    ax2.clabel(cs, inline=True, fontsize=8, fmt='%1.0f°C')

    # Quiver grid sampling (subsample for clean arrow visualization)
    skip = 2
    Y, X = np.mgrid[0:rows:skip, 0:cols:skip]
    u = flux_x[::skip, ::skip]
    v = flux_y[::skip, ::skip]

    # Normalize vectors for visible arrows, scale color by flux magnitude
    norm_mag = np.hypot(u, v) + 1e-6
    q = ax2.quiver(X, Y, u / norm_mag, -v / norm_mag, norm_mag,
                   cmap='cool', scale=22, width=0.005, headwidth=4, headlength=5)
    cbar2 = plt.colorbar(q, ax=ax2, fraction=0.046, pad=0.04)
    cbar2.set_label('Heat Flux Magnitude |q| (W/m²)', color='#38bdf8', fontsize=10, weight='bold')
    cbar2.ax.tick_params(colors='#8899ac')

    ax2.set_title("2. Heat Flux Vector Field (q = -k∇T) & Isotherms", color='#ffffff', fontsize=11, weight='bold', pad=10)
    ax2.set_xlabel("X (m)", color='#8899ac', fontsize=9)
    ax2.set_ylabel("Y (m)", color='#8899ac', fontsize=9)
    ax2.invert_yaxis()

    # -------------------------------------------------------------
    # PANEL 3: 1D SPATIAL SLICE T(x) ACROSS CPU HOTSPOT
    # -------------------------------------------------------------
    ax3 = axes[1, 0]
    cpu_slice_row = int(sim_grid_obj.rows * 0.30)
    gpu_slice_row = int(sim_grid_obj.rows * 0.35)
    t_slice_cpu = T[cpu_slice_row, :]
    t_slice_gpu = T[gpu_slice_row, :]
    x_nodes = np.arange(cols)

    ax3.plot(x_nodes, t_slice_cpu, color='#ef4444', linewidth=2.2, label=f'CPU Cutline (Row {cpu_slice_row})')
    ax3.plot(x_nodes, t_slice_gpu, color='#f59e0b', linewidth=1.8, linestyle='--', label=f'GPU Cutline (Row {gpu_slice_row})')
    ax3.axhline(sim_grid_obj.ambient, color='#00f0ff', linestyle=':', label=f'Ambient ({sim_grid_obj.ambient}°C)')

    # Fill thermal gradient under curve
    ax3.fill_between(x_nodes, t_slice_cpu, sim_grid_obj.ambient, color='#ef4444', alpha=0.15)

    ax3.set_title(f"3. 1D Cross-Section Spatial Profile T(x) at Row {cpu_slice_row}", color='#ffffff', fontsize=11, weight='bold', pad=10)
    ax3.set_xlabel("Node Index X across Motherboard", color='#8899ac', fontsize=9)
    ax3.set_ylabel("Temperature (°C)", color='#8899ac', fontsize=9)
    ax3.grid(True, linestyle=':', alpha=0.25, color='#ffffff')
    ax3.legend(facecolor='#0d1424', edgecolor='#1e293b', labelcolor='#ffffff', fontsize=8)

    # -------------------------------------------------------------
    # PANEL 4: CONVERGENCE RATE & YOUNG'S THEOREM PROOF
    # -------------------------------------------------------------
    ax4 = axes[1, 1]
    ax4.semilogy(res_j['residuals'], color='#00f0ff', linewidth=2.0, label=f"Jacobi ({res_j['iterations']} sweeps)")
    ax4.semilogy(res_gs['residuals'], color='#10b981', linewidth=2.0, label=f"Gauss-Seidel ({res_gs['iterations']} sweeps)")
    ax4.axhline(1e-3, color='#ef4444', linestyle='--', label='Tolerance (1e-3)')

    speedup = res_j['iterations'] / max(1, res_gs['iterations'])
    ax4.text(0.50, 0.70, f"Young's Theorem Speedup: {speedup:.2f}x\nGauss-Seidel requires ~50% sweeps",
             transform=ax4.transAxes, color='#38bdf8', fontsize=9, weight='bold',
             bbox=dict(boxstyle='round,pad=0.5', facecolor='#0d1424', edgecolor='#00f0ff', alpha=0.85))

    ax4.set_title("4. Iterative Convergence (L-inf Norm Residue)", color='#ffffff', fontsize=11, weight='bold', pad=10)
    ax4.set_xlabel("Iteration Sweep Count (k)", color='#8899ac', fontsize=9)
    ax4.set_ylabel("Max Residual ||T^(k+1) - T^(k)||_inf", color='#8899ac', fontsize=9)
    ax4.grid(True, linestyle=':', alpha=0.25, color='#ffffff')
    ax4.legend(facecolor='#0d1424', edgecolor='#1e293b', labelcolor='#ffffff', fontsize=8)

    plt.suptitle("THERMALX — 2D FINITE DIFFERENCE TELEMETRY & VECTOR FLUX DASHBOARD",
                 color='#ffffff', fontsize=14, weight='bold', y=0.98)
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.savefig(save_path, facecolor=fig.get_facecolor(), edgecolor='none', dpi=150)
    plt.close()
    print(f"[SUCCESS] Telemetry dashboard exported to: {save_path}")


if __name__ == '__main__':
    grid = ThermalGrid2D(rows=40, cols=40)
    plot_thermal_telemetry_dashboard(grid, "thermal_telemetry_dashboard.png")
