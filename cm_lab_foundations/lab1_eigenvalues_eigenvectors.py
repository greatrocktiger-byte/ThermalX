import numpy as np
A=np.array ([[2,1],[1,2]])
eigenvalues,eigenvectors=np.linalg.eig(A)
print("Eigenvalues: ",eigenvalues)
print("Eigenvectors:\n",eigenvectors)