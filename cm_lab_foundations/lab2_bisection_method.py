def f(x):
    return x**2-3

def bisection(a,b,tol =1e-6,max_iter = 100):
    if f(a)*f(b)>=0:
        print("Bisection method fails.Choose different interval.")
        return None

    print("Iter\t a\t\t b\t\t c\t\t f(c)")
    for i in range(max_iter):
        #Find midpoint
        c=(a+b)/2
        fc = f(c)
        #Display iteration values
        print(f"{i+1}\t {a:.6f}\t {b:.6f}\t {c:.6f}\t {fc:.6f}")
        #Check Stopping condition
        if abs(fc)<tol:
            return c
        #Decide new interval
        if f(a)*f(c)<0:
            b=c
        else:
            a=c

    return c

#intial interval for x^2-3 = 0
#f(1)=-2 and f(2)=1, so root lies between 1 and 2
root = bisection(1,2)
print("\nApproximate root:",root)

