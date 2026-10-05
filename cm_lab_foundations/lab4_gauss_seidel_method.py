#Gauss-sidel Method

#Initial values
x = 0
y = 0
z = 0

#Number of iterations
n = 10

for i in range(n):
    #calculate x
    x = (85-6*y+z)/27
    #Calculate y using NEW x
    y = (72-6*x-2*z)/15
    #Calculate  z using NEW x and NEW y
    z=(110-x-y)/54


    print("Iteration",i+1)
    print("x=",round(x,3))
    print("y=",round(y,3))
    print("z=",round(z,3))
    print()