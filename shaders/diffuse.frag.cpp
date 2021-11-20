uniform sampler2D trails;

uniform float decayRate;// = 0.1;

vec4 pixel(float x, float y) {
  vec2 p = vec2(x / uViewSize.x, y / uViewSize.y);

  vec2 vert = vec2(0.0, 1.0 / uViewSize.y);
  vec2 horiz = vec2(1.0 / uViewSize.x, 0.0);

  vec4 sum = texture2D(trails, p);
  sum += texture2D(trails, p + vert);
  sum += texture2D(trails, p + horiz);
  sum += texture2D(trails, p - vert);
  sum += texture2D(trails, p - horiz);

  return vec4(sum.xyz / 5.0 * (1.0 - decayRate), 1.0);
}