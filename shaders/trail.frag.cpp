precision highp float;

uniform vec2 uViewSize;
uniform vec2 mousePos;
uniform bool followMouse;

varying float direction;


uniform float color;
uniform float colorOffset;

void main() {
  vec2 colorab;

  float dir = fract(direction + colorOffset);
  if (dir < 0.5) {
    colorab = vec2(0.0, 1.0 - 2.0 * dir);
  } else {
    colorab = vec2(2.0 * dir - 1.0, 0.0);
  }

  if (color == 0.0) {
    gl_FragColor = vec4(colorab, 1.0, 1.0);
  } else if (color == 1.0) {
    gl_FragColor = vec4(1.0, colorab, 1.0);
  } else {
    gl_FragColor = vec4(colorab[0], 1.0, colorab[1], 1.0);
  }

  if (followMouse) {
    float x = gl_FragCoord.x / uViewSize.x;
    float y = gl_FragCoord.y / uViewSize.y;
    vec2 pos = vec2(x, y);

    float dist = length(pos - mousePos);
    float strength = 1.0 / (dist + 1.0);
    gl_FragColor *= strength;
  }
}