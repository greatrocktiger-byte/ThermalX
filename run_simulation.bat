@echo off
title THERMALX - 2D Semiconductor PDE Solver
color 0B
echo =====================================================================
echo               THERMALX - NUMERICAL COMPUTATION SUITE
echo =====================================================================
echo Launching Python Numerical Solver & Telemetry Engine...
echo.
python main.py --all
echo.
echo =====================================================================
echo Simulation complete! Generated telemetry image: thermal_telemetry_dashboard.png
echo Press any key to open the interactive menu or close this window...
echo =====================================================================
pause
python main.py
