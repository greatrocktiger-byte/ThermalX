import sympy as sp

# Define variables
x, y = sp.symbols('x y')

# Define M and N
M = 12*x + 5*y - 9
N = 5*x - 2*y - 4

# Print the original differential equation
print("Original differential equation:")
print(f"({M}) dx + ({N}) dy = 0")

# Check exactness
My = sp.diff(M, y)
Nx = sp.diff(N, x)

print("\nPartial derivatives:")
print("∂M/∂y =", My)
print("∂N/∂x =", Nx)

if My == Nx:
    print("\nThe equation is EXACT.")

    # Integrate M with respect to x
    F = sp.integrate(M, x)

    print("\nIntegrating M with respect to x:")
    print("F =", F, "+ g(y)")

    # Find g'(y)
    g_prime = sp.simplify(N - sp.diff(F, y))

    print("\nFinding g'(y):")
    print("g'(y) =", g_prime)

    # Integrate g'(y)
    g = sp.integrate(g_prime, y)

    print("\nIntegrating g'(y):")
    print("g(y) =", g)

    # Complete F
    F = sp.expand(F + g)

    print("\nComplete solution:")
    print("F(x,y) =", F)

    print("\nFinal answer:")
    print(F, "= C")

else:
    print("\nThe equation is NOT exact.")