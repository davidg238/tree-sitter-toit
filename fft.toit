import math show PI cos sin log

class FastFourierTransform:

  real/ List
  imag/ List

  constructor signal/ List:
    // Create copies to avoid modifying the original signal
    real = List signal.size: signal[it]
    imag = List signal.size 0.0

  forward-real:
    n := real.size
    if n < 2 or (n & (n - 1)) != 0:
      throw "FFT size must be a power of 2"

    // --- Bit reversal permutation ---
    j := 0
    for i := 0; i < n - 1; i++:
      if i < j:
        // Swap real parts
        tr := real[j]
        real[j] = real[i]
        real[i] = tr
        // Swap imaginary parts
        ti := imag[j]
        imag[j] = imag[i]
        imag[i] = ti

      k := n >> 1
      while j >= k:
        j -= k
        k >>= 1
      j += k

    // --- Cooley-Tukey FFT ---
    length := 2
    while length <= n:
      wlen := -2.0 * PI / length.to-float
      wpr := cos wlen
      wpi := sin wlen
      
      i := 0
      while i < n:
        wr := 1.0
        wi := 0.0
        
        for jj := 0; jj < length / 2; jj++:
          u := real[i + jj]
          v := imag[i + jj]
          
          s := real[i + jj + length / 2]
          t := imag[i + jj + length / 2]
          
          // Complex multiplication: (s + ti) * (wr + wi*i)
          s_new := s * wr - t * wi
          t_new := s * wi + t * wr
          
          real[i + jj] = u + s_new
          imag[i + jj] = v + t_new
          
          real[i + jj + length / 2] = u - s_new
          imag[i + jj + length / 2] = v - t_new
          
          // Update twiddle factors
          wr_temp := wr
          wr = wr_temp * wpr - wi * wpi
          wi = wr_temp * wpi + wi * wpr
        
        i += length
      
      length <<= 1
    
    return imag

  forward-real-power-normalised_ n/float -> List:
    // Create a copy to avoid modifying the original data
    real_copy := List real.size: real[it]
    imag_copy := List imag.size: imag[it]
    
    // Ensure FFT has been computed
    forward-real
    
    result := List real.size 0.0
    for k := 0; k < real.size; k++:
      r := real[k]
      i := imag[k]
      result[k] = n * (r * r + i * i)  // Power = magnitude squared * normalization
    
    // Restore original data
    for k := 0; k < real.size; k++:
      real[k] = real_copy[k]
      imag[k] = imag_copy[k]
    
    return result

  forward-real-power -> List:
    n := real.size.to-float
    normalization := 2.0 / (n * n)
    return forward-real-power-normalised_ normalization
