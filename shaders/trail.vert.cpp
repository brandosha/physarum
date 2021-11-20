precision highp float;

attribute float aVertexIndex;

uniform float particleCount;
uniform sampler2D particles;

uniform vec2 uViewSize;

varying float direction;

float decodeFloat(vec2 a) {
  return a.x + a.y / 255.0;
}

vec3 getParticle() {
  float i = aVertexIndex * 2.0;

  float pixelCount = particleCount * 2.0;
  float totalRows = ceil(pixelCount / uViewSize.x);
  float totalCols = min(pixelCount, uViewSize.x);

  float x1 = (mod(i, totalCols) + 0.5) / totalCols;
  float y1 = (floor(i / totalCols) + 0.5) / totalRows;
  float x2 = (mod(i + 1.0, totalCols) + 0.5) / totalCols;
  float y2 = (floor((i + 1.0) / totalCols) + 0.5) / totalRows;

  vec4 tex1 = texture2D(particles, vec2(x1, y1));
  vec4 tex2 = texture2D(particles, vec2(x2, y2));

  return vec3(decodeFloat(tex1.xy), decodeFloat(tex1.zw), decodeFloat(tex2.xy));
}

void main() {
  // float pixelCount = particleCount * 2.0;
  // float totalRows = ceil(pixelCount / uViewSize.x);
  // float totalCols = min(pixelCount, uViewSize.x);

  // float i = aVertexIndex * 2.0;
  // float sampleX = mod(i, totalCols) + 0.5;
  // float sampleY = floor(i / totalCols) + 0.5;

  // vec4 particle = texture2D(particles, vec2(sampleX / totalCols, sampleY / totalRows));

  // vec2 pos = vec2(decodeFloat(particle.xy), decodeFloat(particle.zw));
  vec3 particle = getParticle();
  vec2 pos = particle.xy;
  pos = 2.0 * pos - 1.0;

  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = 1.0;

  direction = particle.z;
}