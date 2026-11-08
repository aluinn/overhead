/**
 * GLSL for the globe. Kept as plain strings so they can be unit-inspected and
 * reused by the embed example without a bundler plugin.
 */

export const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    // The Earth mesh is never rotated (we render in the Earth-fixed frame),
    // so the object-space normal is already the world-space normal.
    vNormalW = normalize(normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const earthFragment = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uSpecular;
  uniform vec3 uSunDir;
  uniform vec3 uAccent;

  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    vec3 n = normalize(vNormalW);
    float sun = dot(n, normalize(uSunDir));

    // Soft terminator: 0 in full night, 1 in full day.
    float day = smoothstep(-0.12, 0.22, sun);

    vec3 dayCol = texture2D(uDay, vUv).rgb;
    vec3 nightCol = texture2D(uNight, vUv).rgb;
    float ocean = texture2D(uSpecular, vUv).r;

    // Darken the day side overall: this is a dark, moody Earth.
    vec3 lit = dayCol * (0.18 + 0.85 * max(sun, 0.0));

    // Specular glint off the oceans.
    vec3 h = normalize(normalize(uSunDir) + vViewDir);
    float spec = pow(max(dot(n, h), 0.0), 60.0) * ocean * day * 0.55;
    lit += vec3(spec);

    // City lights only on the night side, warm and slightly boosted.
    vec3 lights = pow(nightCol, vec3(0.9)) * vec3(1.35, 1.05, 0.7) * 1.6;
    vec3 night = dayCol * 0.025 + lights;

    vec3 col = mix(night, lit, day);

    // Thin accent-tinted rim to separate the limb from space.
    float fresnel = pow(1.0 - max(dot(n, vViewDir), 0.0), 3.0);
    col += uAccent * fresnel * 0.22;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export const atmosphereVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform float uInvRadius; // planet radius / shell radius

  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    vec3 n = normalize(vNormalW);
    // Back faces of the shell: d is 0 at the shell's outer silhouette and
    // grows toward the planet's limb, where it reaches dLimb.
    float d = max(-dot(n, normalize(vViewDir)), 0.0);
    float dLimb = sqrt(1.0 - uInvRadius * uInvRadius);
    float glow = pow(clamp(d / dLimb, 0.0, 1.0), 2.4);

    // Brighter on the sunlit limb, never fully off.
    float sun = dot(n, normalize(uSunDir));
    float lit = 0.3 + 0.7 * smoothstep(-0.4, 0.5, sun);

    float a = glow * lit;
    gl_FragColor = vec4(uColor * a * 1.5, a);
    #include <colorspace_fragment>
  }
`;

export const starVertex = /* glsl */ `
  attribute float aSize;
  attribute float aTwinkle;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio;
    vAlpha = 0.55 + 0.45 * sin(uTime * (0.4 + aTwinkle) + aTwinkle * 40.0);
  }
`;

export const starFragment = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(vec3(0.82, 0.9, 1.0), a * 0.9);
    #include <colorspace_fragment>
  }
`;
