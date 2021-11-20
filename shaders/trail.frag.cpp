precision highp float;

uniform vec2 uViewSize;
uniform vec2 mousePos;
uniform bool followMouse;

varying float direction;

void main() {

  if (direction < 0.5) {
    gl_FragColor = vec4(0.0, 1.0 - 2.0 * direction, 1.0, 1.0);
  } else {
    gl_FragColor = vec4(2.0 * direction - 1.0, 0.0, 1.0, 1.0);
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