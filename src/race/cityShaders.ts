import {
  AdditiveBlending,
  BackSide,
  Color,
  CustomBlending,
  DoubleSide,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  UniformsLib,
  UniformsUtils,
  Vector3,
  type Texture,
} from 'three';
import { CITY_COLORS } from '../data/theme';

/*
 * Hand-written materials for the neon city. They share one convention: the
 * "body" colour is fogged and tone-mapped like the built-in materials (so it
 * melts into the sky at the horizon), while neon light is added on top and
 * only partly fogged — it keeps glowing through the haze.
 */

const FOG_FRAGMENT_HELPERS = /* glsl */ `
#include <fog_pars_fragment>
float fogAmount() {
  #ifdef USE_FOG
    return smoothstep(fogNear, fogFar, vFogDepth);
  #else
    return 0.0;
  #endif
}
vec3 toneMapBase(vec3 color) {
  #if defined( TONE_MAPPING )
    return toneMapping(color);
  #else
    return color;
  #endif
}
`;

/** Shared by buildings and their signs: sink below the ground, then rise with an ease-out. */
const RISE_VERTEX = /* glsl */ `
attribute vec2 aRise;
uniform float uRise;
float riseOffset() {
  float rise = clamp((uRise - aRise.x) * 2.2, 0.0, 1.0);
  rise = 1.0 - pow(1.0 - rise, 3.0);
  return (1.0 - rise) * aRise.y;
}
`;

const HASH = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
`;

/*
 * Per-building / per-face constants feed the window and flicker hashes. They
 * are `flat`: interpolation jitters a constant by ~1e-7 from pixel to pixel,
 * and the hash amplifies that into striped, z-fighting-like panes.
 */
const BUILDING_FLAT_VARYINGS = /* glsl */ `
flat varying vec3 vFaceNormal;
flat varying vec3 vSize;
flat varying vec3 vNeon;
flat varying float vSeed;
`;

const color = (hex: number): Color => new Color(hex);

/** Gradient dome with a striped synthwave sun and twinkling stars. Follows the camera. */
export function createSkyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uZenith: { value: color(CITY_COLORS.skyZenith) },
      uMid: { value: color(CITY_COLORS.skyMid) },
      uHorizon: { value: color(CITY_COLORS.horizon) },
      uGlow: { value: color(CITY_COLORS.horizonGlow) },
      uSunTop: { value: color(CITY_COLORS.sunTop) },
      uSunBottom: { value: color(CITY_COLORS.sunBottom) },
      uSunDir: { value: new Vector3(0, 0.075, -1).normalize() },
      uSunSize: { value: 0.12 },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uGlow;
      uniform vec3 uSunTop;
      uniform vec3 uSunBottom;
      uniform vec3 uSunDir;
      uniform float uSunSize;
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vDir;
      ${HASH}
      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        vec3 col = mix(uHorizon, uMid, smoothstep(0.015, 0.3, h));
        col = mix(col, uZenith, smoothstep(0.25, 0.8, h));
        // Warm band hugging the horizon (above it only: below, the fog colour takes over).
        col = mix(col, uGlow, exp(-max(h, 0.0) * 26.0) * 0.75 * step(0.0, h));

        // Sun: vertical gradient, with the classic gaps opening towards its base.
        float d = distance(dir, uSunDir);
        float t = clamp((dir.y - uSunDir.y) / uSunSize * 0.5 + 0.5, 0.0, 1.0);
        float gap = step(fract(t * 9.0 - uTime * 0.12), clamp((0.52 - t) * 1.25, 0.0, 0.7));
        float disc = (1.0 - smoothstep(uSunSize - 0.003, uSunSize, d)) * (1.0 - gap);
        col += uSunBottom * 0.28 * exp(-max(d - uSunSize, 0.0) * 9.0) * step(0.0, h);
        col = mix(col, mix(uSunBottom, uSunTop, smoothstep(0.05, 0.95, t)), disc * step(0.0, h));

        // Stars, fading out towards the horizon.
        vec3 cell = floor(dir * 320.0);
        float star = step(0.9975, hash21(cell.xy + cell.z * 7.13));
        star *= smoothstep(0.18, 0.55, h) * (0.55 + 0.45 * sin(uTime * 2.5 + hash21(cell.zy) * 40.0));
        col += vec3(star);

        if (h < 0.0) col = uHorizon;
        gl_FragColor = vec4(col, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    // Drawn first in the opaque pass, alpha-blended over the CSS page so it can fade in.
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
  });
}

/** Endless dark ground with a neon grid, far below the elevated highway. */
export function createGridMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uBase: { value: color(CITY_COLORS.ground) },
        uLine: { value: color(CITY_COLORS.grid) },
        uCell: { value: 7 },
        uTime: { value: 0 },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      uniform vec3 uLine;
      uniform float uCell;
      uniform float uTime;
      varying vec3 vWorld;
      ${FOG_FRAGMENT_HELPERS}
      void main() {
        vec2 p = vWorld.xz / uCell;
        vec2 w = fwidth(p);
        vec2 g = abs(fract(p - 0.5) - 0.5) / max(w * 1.6, 1e-4);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        // Lines that shrink below a pixel fade out instead of shimmering.
        line *= 1.0 - smoothstep(0.12, 0.45, max(w.x, w.y));
        // A pulse runs along the grid towards the city.
        float pulse = 0.65 + 0.35 * sin(vWorld.z * 0.12 + uTime * 3.0);
        float fog = fogAmount();
        vec3 base = toneMapBase(mix(uBase, fogColor, fog));
        gl_FragColor = vec4(base + uLine * line * pulse * (1.0 - fog * 0.8), 1.0);
        #include <colorspace_fragment>
      }
    `,
    fog: true,
  });
}

/**
 * Instanced boxes (base at y = 0, scaled per instance) with procedural lit
 * windows, neon crowns and edge strips. They rise out of the ground as the
 * race set builds (`uRise`, staggered per building by `aRise`).
 */
export function createBuildingMaterial(): ShaderMaterial {
  const [winA, winB, winC] = CITY_COLORS.windows;
  return new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uBody: { value: color(CITY_COLORS.building) },
        uBodyTop: { value: color(CITY_COLORS.buildingTop) },
        uRoof: { value: color(CITY_COLORS.roof) },
        uWinA: { value: color(winA) },
        uWinB: { value: color(winB) },
        uWinC: { value: color(winC) },
        uRise: { value: 0 },
        uLights: { value: 0 },
        uTime: { value: 0 },
      },
    ]),
    vertexShader: /* glsl */ `
      attribute vec3 aNeon;
      attribute float aSeed;
      ${RISE_VERTEX}
      varying vec3 vLocal;
      ${BUILDING_FLAT_VARYINGS}
      varying float vDepth;
      #include <fog_pars_vertex>
      void main() {
        vec3 size = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vSize = size;
        vLocal = position * size;
        vFaceNormal = normal;
        vNeon = aNeon;
        vSeed = aSeed;
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        world.y -= riseOffset();
        vec4 mvPosition = viewMatrix * world;
        vDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody;
      uniform vec3 uBodyTop;
      uniform vec3 uRoof;
      uniform vec3 uWinA;
      uniform vec3 uWinB;
      uniform vec3 uWinC;
      uniform float uLights;
      uniform float uTime;
      varying vec3 vLocal;
      ${BUILDING_FLAT_VARYINGS}
      varying float vDepth;
      ${FOG_FRAGMENT_HELPERS}
      ${HASH}
      void main() {
        vec3 body = uRoof;
        vec3 glow = vec3(0.0);
        if (vFaceNormal.y < 0.5) {
          bool sideFace = abs(vFaceNormal.x) > 0.5;
          float along = sideFace ? vLocal.z : vLocal.x;
          float halfW = (sideFace ? vSize.z : vSize.x) * 0.5;
          float y = vLocal.y;
          float t = y / vSize.y;
          body = mix(uBody, uBodyTop, t * t);

          vec2 cell = vec2((along + halfW) / 1.25, y / 1.6);
          vec2 id = floor(cell);
          vec2 f = fract(cell);
          float pane = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.78);
          float inside = step(0.55, halfW - abs(along)) * step(2.4, y) * step(y, vSize.y - 1.3);
          float r = hash21(id + vec2(vSeed * 91.7, sideFace ? 17.0 : 3.0) + vFaceNormal.xz * 5.0);
          // Lights switch on building by building, then a few flicker now and then.
          float on = step(0.58, r) * step(vSeed * 0.7 + r * 0.3, uLights);
          on *= step(0.04, hash21(id + floor(uTime * 1.5 + r * 7.0)));
          vec3 win = r > 0.93 ? uWinB : (r > 0.85 ? uWinC : uWinA);
          // Far away the panes are sub-pixel: blend to their average instead of shimmering.
          float detail = 1.0 - smoothstep(80.0, 190.0, vDepth);
          glow += win * inside * mix(0.17 * step(0.001, uLights), pane * on, detail) * 0.9;

          float edge = step(halfW - 0.24, abs(along)) * step(0.55, vSeed);
          float crown = step(vSize.y - 0.8, y) * step(y, vSize.y - 0.35) * step(vSeed, 0.85);
          glow += vNeon * (edge * 0.9 + crown * 1.3) * uLights;
        }
        float fog = fogAmount();
        vec3 base = toneMapBase(mix(body, fogColor, fog));
        gl_FragColor = vec4(base + glow * (1.0 - fog * 0.6), 1.0);
        #include <colorspace_fragment>
      }
    `,
    fog: true,
  });
}

/** Neon signs from a canvas atlas; a few are "broken" and stutter. */
export function createSignMaterial(map: Texture): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uMap: { value: null }, uOn: { value: 0 }, uRise: { value: 0 }, uTime: { value: 0 } }]),
    vertexShader: /* glsl */ `
      attribute float aSeed;
      ${RISE_VERTEX}
      varying vec2 vUv;
      flat varying float vSeed;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vSeed = aSeed;
        vec3 transformed = position;
        transformed.y -= riseOffset();
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uOn;
      uniform float uTime;
      varying vec2 vUv;
      // Hashed for the broken-tube stutter: flat for the same reason as the buildings.
      flat varying float vSeed;
      ${FOG_FRAGMENT_HELPERS}
      ${HASH}
      void main() {
        vec3 tex = texture2D(uMap, vUv).rgb;
        float lit = step(vSeed * 0.8, uOn);
        if (vSeed > 0.82) lit *= step(0.22, hash11(floor(uTime * 8.0) + vSeed * 311.0));
        float fog = fogAmount();
        vec3 panel = toneMapBase(mix(vec3(0.012, 0.006, 0.03), fogColor, fog));
        vec3 neon = tex * mix(0.06, 1.25, lit) * (1.0 - fog * 0.55);
        gl_FragColor = vec4(panel + neon, 1.0);
        #include <colorspace_fragment>
      }
    `,
    fog: true,
  });
  // Assigned after merge(): merge() clones uniform values, textures included.
  material.uniforms.uMap.value = map;
  return material;
}

/**
 * The racer's name as a giant hologram over the skyline: scanlined and
 * flickering in. Alpha-blended (not additive) so it still reads against the
 * bright horizon glow.
 */
export function createHologramMaterial(map: Texture): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms: { uMap: { value: map }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      ${HASH}
      void main() {
        vec2 uv = vUv;
        // Occasional horizontal glitch.
        float glitch = step(0.94, hash11(floor(uTime * 6.0))) * step(abs(uv.y - hash11(floor(uTime * 6.0) + 3.0)), 0.06);
        uv.x += glitch * 0.02;
        vec4 tex = texture2D(uMap, uv);
        float scan = 0.85 + 0.25 * sin(uv.y * 260.0 - uTime * 9.0);
        gl_FragColor = vec4(tex.rgb * scan, tex.a * uOpacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    // Projected over the skyline: the towers between it and the highway never cut it.
    depthTest: false,
    // It is a light source: no haze.
    fog: false,
  });
  return material;
}

/** Soft volumetric searchlight cone (additive). */
export function createBeamMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uColor: { value: color(0xc9b4ff) }, uOpacity: { value: 0 } }]),
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying float vFacing;
      #include <fog_pars_vertex>
      void main() {
        vAlong = uv.y;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vec3 viewNormal = normalize(normalMatrix * normal);
        vFacing = abs(dot(viewNormal, normalize(-mvPosition.xyz)));
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlong;
      varying float vFacing;
      ${FOG_FRAGMENT_HELPERS}
      void main() {
        float a = pow(1.0 - vAlong, 1.6) * vFacing * vFacing * 0.3 * uOpacity;
        gl_FragColor = vec4(uColor * a * (1.0 - fogAmount() * 0.5), 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    fog: true,
  });
}
