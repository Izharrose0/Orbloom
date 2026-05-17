// Ashima 3D simplex noise - reusable GLSL chunk.
export const simplexNoise3D = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute( permute( permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

float fbm(vec3 p){
  float v = 0.0;
  float a = 0.5;
  for(int i=0;i<5;i++){
    v += a * snoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

// ===== Additional noise families for surface variety =====

float hashCell(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// 1) Ridged multifractal — sharp mountain ridges
float ridgedFbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * (1.0 - 2.0 * abs(snoise(p)));
    p *= 2.02;
    a *= 0.5;
  }
  return v * 0.6;
}

// 2) Voronoi cell noise — rocky / cellular
float voronoi3D(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  float minD = 8.0;
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 b = vec3(float(i), float(j), float(k));
    vec3 o = vec3(hashCell(p + b),
                  hashCell(p + b + vec3(17.0)),
                  hashCell(p + b + vec3(39.0)));
    vec3 r = b + o - f;
    minD = min(minD, dot(r, r));
  }
  return sqrt(minD) * 1.5 - 0.75;
}

float voronoiFbm(vec3 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 3; i++) {
    v += a * voronoi3D(p);
    p *= 2.0;
    a *= 0.55;
  }
  return v;
}

// 3) Worley smooth — smoother cellular (softer edges)
float worleySmooth(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  float minD = 4.0;
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 b = vec3(float(i), float(j), float(k));
    vec3 o = vec3(hashCell(p + b),
                  hashCell(p + b + vec3(17.0)),
                  hashCell(p + b + vec3(39.0)));
    vec3 r = b + o - f;
    float d = length(r);
    minD = mix(min(minD, d), minD * d, 0.0);
    minD = min(minD, d);
  }
  return smoothstep(0.0, 1.2, minD) * 2.0 - 1.0;
}

// 4) Domain-warped fbm — surreal flowing
float warpedFbm(vec3 p) {
  vec3 q = vec3(
    fbm(p),
    fbm(p + vec3(5.2, 1.3, 9.1)),
    fbm(p + vec3(2.5, 8.4, 3.7))
  );
  return fbm(p + 2.4 * q);
}

// 5) Turbulence — billowy
float turbulence(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * abs(snoise(p));
    p *= 2.02;
    a *= 0.5;
  }
  return v * 1.6 - 0.8;
}

// Dispatcher: 0=fbm(simplex) 1=ridged 2=voronoi 3=worley 4=warped 5=turbulence
float surfaceNoise(vec3 p, float typef) {
  int t = int(typef + 0.5);
  if (t == 1) return ridgedFbm(p);
  if (t == 2) return voronoiFbm(p);
  if (t == 3) return worleySmooth(p);
  if (t == 4) return warpedFbm(p);
  if (t == 5) return turbulence(p);
  return fbm(p);
}
`;
