precision highp float;

attribute float aVertexIndex;

uniform float particleCount;
uniform sampler2D particles;

uniform vec2 uViewSize;

float decodeFloat(vec2 a) {
  return a.x + a.y / 255.0;
}

void main() {
  float pixelCount = particleCount * 2.0;
  float totalRows = ceil(pixelCount / uViewSize.x);
  float totalCols = min(pixelCount, uViewSize.x);

  float i = aVertexIndex * 2.0;
  float sampleX = mod(i, totalCols) + 0.5;
  float sampleY = floor(i / totalCols) + 0.5;

  vec4 particle = texture2D(particles, vec2(sampleX / totalCols, sampleY / totalRows));

  vec2 pos = vec2(decodeFloat(particle.xy), decodeFloat(particle.zw));
  pos = 2.0 * pos - 1.0;

  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = 1.0;
}