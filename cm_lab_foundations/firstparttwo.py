import numpy as np
B=np.array ([[1,-2],[2,1]])
eigenvalues,eigenvectors=np.linalg.eig(B)
print("Eigenvalues: ",eigenvalues)
print("Eigenvectors:\n",eigenvectors)