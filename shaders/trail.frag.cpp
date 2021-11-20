precision highp float;

uniform vec2 uViewSize;
uniform vec2 mousePos;
uniform bool followMouse;

void main() {
  float x = gl_FragCoord.x / uViewSize.x;
  float y = gl_FragCoord.y / uViewSize.y;

  gl_FragColor = vec4(1.0, x, y, 1.0);

  if (followMouse) {
    vec2 pos = vec2(x, y);
    float dist = length(pos - mousePos);
    float strength = 1.0 / (dist + 1.0);
    gl_FragColor.x = strength;
  }
}