#include <omp.h>
void transform(float *X, float *Y, int N) {
  float total = 0.0f;
  #pragma omp parallel for reduction(+ : total)
  for (int i = 0; i < N; ++i) total += X[i];
  Y[0] = total * 2.0f;
  for (int i = 1; i < N; ++i) Y[i] = X[i] * 2.0f;
}
