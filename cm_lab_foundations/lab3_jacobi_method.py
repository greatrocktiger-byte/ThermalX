x,y,z =0,0,0

for i in range(10):
    x_new = (85-6*y+z)/27
    y_new = (72-6*x-2*z)/15
    z_new = (110-x-y)/54

    x,y,z = x_new,y_new,z_new
    print("Step",i+1,":",x,y,z)
print("Final Answer:",x,y,z)