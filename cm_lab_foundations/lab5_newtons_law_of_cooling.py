import math
#Given Values
Ts = 25   #Surrounding temperature (*c)
T0 = 100  #Initial  temperature of body (*c)
T1 = 75  #Temperature after 1 minute(*c)
t1 = 1  #Time = 1 minute
t = 3  #TIme at which tempeerature is required

#Newton law of cooling
#T-Ts = (T0 - Ts)*e^(-kt)
#Find k using temperature after 1 minute
k = -math.log((T1-Ts)/(T0-Ts))
print("Value of k =",k,"per minute")
#Find temperature after 3  minutes
T = Ts + (T0 - Ts)*math.exp(-k*t)
print("Temperature after 3 minutes =",T,"*c")