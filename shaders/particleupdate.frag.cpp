precision highp sampler2D;

uniform float particleCount;
uniform sampler2D particles;
uniform sampler2D trails;

#define TAU 6.2831853072

uniform vec3 randomSeed;
float random0(vec2 seed) {
  seed.x = floor(seed.x * uViewSize.x) / uViewSize.x;
  seed.y = floor(seed.y * uViewSize.y) / uViewSize.y;

  if (abs(seed.x) > abs(seed.y)) {
    return fract(length(seed * randomSeed[0]) + randomSeed[2]);
  } else {
    return fract(length(seed * randomSeed[1]) + randomSeed[2]);
  }
}
float random(vec2 seed) {
  return random0(vec2(random0(seed), random0(seed - 1.0)));
}

float byte(float a) {
  return floor(a * 255.0) / 255.0;
}
float decodeFloat(vec2 a) {
  return a.x + a.y / 255.0;
}
vec2 encodeFloat(float a) {
  return vec2(byte(a), byte(fract(a * 255.0)));
}

float pixelCount;
bool isLeftPixel;
vec4 getParticle(float x, float y) {
  float i = floor(x) + floor(y) * uViewSize.x;

  float totalCols = ceil(pixelCount / uViewSize.x);
  float totalRows = min(pixelCount, uViewSize.x);

  vec2 leftPixelCoord = vec2(x - 1.0, y);
  if (leftPixelCoord.x < 0.0) {
    leftPixelCoord.x = totalRows;
    leftPixelCoord.y -= 1.0;
  }
  leftPixelCoord.x /= totalRows;
  leftPixelCoord.y /= totalCols;
  vec4 leftPixel = texture2D(particles, leftPixelCoord);

  vec2 rightPixelCoord = vec2(x + 1.0, y);
  if (rightPixelCoord.x < 0.0) {
    rightPixelCoord.x = 0.0;
    rightPixelCoord.y += 1.0;
  }
  rightPixelCoord.x /= totalRows;
  rightPixelCoord.y /= totalCols;
  vec4 rightPixel = texture2D(particles, rightPixelCoord);

  vec4 centerPixel = texture2D(particles, vec2(x / totalRows, y / totalCols));

  vec4 pixels[2];
  isLeftPixel = mod(i, 2.0) < 1.0;
  if (isLeftPixel) {
    pixels[0] = centerPixel;
    pixels[1] = rightPixel;
  } else {
    pixels[0] = leftPixel;
    pixels[1] = centerPixel;
  }

  vec2 pos = vec2(decodeFloat(pixels[0].xy), decodeFloat(pixels[0].zw));
  float direction = decodeFloat(pixels[1].xy);

  return vec4(pos, direction, 0.0);
}

uniform float randomness;
uniform float turnSpeed;// = 0.05;
uniform float moveSpeed;// = 0.001;
const bool wrapEdges = true; // Won't work with wrapEdges false

uniform float sensorDistance;// = 15.0;
uniform mat2 rotation;
uniform mat2 invRotation;
/*const float sensorAngle = TAU / 360.0 * 45.0;
const mat2 rotation = mat2(
  vec2(cos(sensorAngle), -sin(sensorAngle)),
  vec2(sin(sensorAngle), cos(sensorAngle))
);
const mat2 invRotation = mat2(
  vec2(cos(-sensorAngle), -sin(-sensorAngle)),
  vec2(sin(-sensorAngle), cos(-sensorAngle))
);*/

float sampleTrails(vec2 coord) {
  if (wrapEdges) {
    coord = fract(coord);
  } else if (coord.x < 0.0 || coord.y < 0.0 || coord.x > 1.0 || coord.y > 1.0) {
    return 0.0;
  }

  return texture2D(trails, coord).x;
}

float turnDirection(vec2 p, vec2 v) {
  float dx = 1.0 / uViewSize.x;
  float dy = 1.0 / uViewSize.y;

  vec2 sensor = vec2(v.x * dx, v.y * dy) * sensorDistance;

  float s_n = sampleTrails(p + sensor * invRotation);
  float s_0 = sampleTrails(p + sensor);
  float s_p = sampleTrails(p + sensor * rotation);

  if (s_p > s_0 && s_0 > s_n) {
    return turnSpeed;
  } else if (s_n > s_0 && s_0 > s_p) {
    return -turnSpeed;
  } else if (s_p > s_0 && s_n > s_0) {
    return (floor(random(p) + 0.5) * 2.0 - 1.0) * randomness * turnSpeed;
  } else {
    return 0.0;
  }
}

vec4 pixel(float x, float y) {
  pixelCount = particleCount * 2.0;
  float i = floor(x) + floor(y) * uViewSize.x;

  if (i >= pixelCount * 2.0) {
    return vec4(0.0);
  }

  vec4 particle = getParticle(x, y);
  vec2 pos = particle.xy;

  if (!wrapEdges) {
    if (pos.y > 1.0) {
      particle.z = random(pos) * 0.5 + 0.5;
    } else if (pos.y < 0.0) {
      particle.z = random(pos) * 0.5;
    } else if (pos.x > 1.0) {
      particle.z = random(pos) * 0.5 + 0.25;
    } else if (pos.x < 0.0) {
      particle.z = random(pos) * 0.5 - 0.25;
      if (particle.z < 0.0) {
        particle.z += 1.0;
      }
    }
  }

  float direction = TAU * particle.z;
  vec2 v = vec2(cos(direction), sin(direction));

  if (isLeftPixel) {
    pos += v * moveSpeed;
    if (wrapEdges) {
      pos = fract(pos);
    }

    return vec4(encodeFloat(pos.x), encodeFloat(pos.y));
  } else {
    particle.z = fract(particle.z + turnDirection(pos, v));

    return vec4(encodeFloat(particle.z), 1.0, 1.0);
  }
}