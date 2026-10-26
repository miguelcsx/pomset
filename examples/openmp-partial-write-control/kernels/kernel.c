#include <omp.h>
void transform(float *X, float *Y, int N) {
  #pragma omp parallel for
  for (int i = 0; i < N; ++i) Y[i] = X[i] * 2.0f;
}
