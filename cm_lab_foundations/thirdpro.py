def f(x):
    return x**3 - x - 2

def df(x):
    return 3*x**2 - 1   # derivative

def newton_raphson(x0, tol=1e-6, max_iter=20):
    print("Iter\t x\t\t f(x)")
    
    for i in range(max_iter):
        fx = f(x0)
        print(f"{i+1}\t {x0:.6f}\t {fx:.6f}")
        
        if abs(fx) < tol:
            return x0
        
        x0 = x0 - fx / df(x0)   # Newton formula
    
    return x0

# Initial guess
root = newton_raphson(1)

print("\nApproximate root:", root)